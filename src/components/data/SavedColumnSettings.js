import _ from 'lodash/fp'
import { Fragment, useEffect, useRef, useState } from 'react'
import { div, h, hr, li, p, span, ul } from 'react-hyperscript-helpers'
import { ButtonOutline, Clickable, IdContainer, spinnerOverlay } from 'src/components/common'
import { icon } from 'src/components/icons'
import { AutocompleteTextInput } from 'src/components/input'
import { MenuButton, MenuTrigger } from 'src/components/PopupTrigger'
import { ColumnSettings } from 'src/components/table'
import TooltipTrigger from 'src/components/TooltipTrigger'
import { Ajax } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { withErrorReporting } from 'src/libs/error'
import Events from 'src/libs/events'
import { FormLabel } from 'src/libs/forms'
import { useCancellation, useOnMount } from 'src/libs/react-utils'
import { noWrapEllipsis } from 'src/libs/style'
import { cond, editWorkspaceError, withBusyState } from 'src/libs/utils'


const savedColumnSettingsWorkspaceAttributeName = 'system:columnSettings'

// Compress settings to avoid storing 'name' and 'visible' keys many times
const encodeColumnSettings = _.flatMap(({ name, visible }) => [name, visible])
const decodeColumnSettings = _.flow(
  _.chunk(2),
  _.map(([name, visible]) => ({ name, visible }))
)

const useSavedColumnSettings = ({ workspaceId, snapshotName, entityMetadata, entityType }) => {
  // Saved column settings for all tables are stored in the same attribute in the format:
  // {
  //   snapshots: {
  //      snapshot_name: {
  //        table_name: {
  //          settings_name: settings,
  //          ...
  //        },
  //        ...
  //      },
  //      ...
  //    },
  //    tables: {
  //      table_name: {
  //        settings_name: settings,
  //        ...
  //      },
  //      ...
  //    }
  // }
  const baseKey = snapshotName ? `snapshots.${snapshotName}` : 'tables'
  const entityTypeKey = `${baseKey}.${entityType}`

  const signal = useCancellation()

  const getAllSavedColumnSettings = async () => {
    const { namespace, name } = workspaceId
    const { workspace: { attributes } } = await Ajax(signal).Workspaces.workspace(namespace, name).details(['workspace.attributes'])
    return _.flow(
      _.getOr('{}', savedColumnSettingsWorkspaceAttributeName),
      JSON.parse,
      // Drop any column settings for entity types that no longer exist
      _.update(baseKey, _.pick(_.keys(entityMetadata)))
    )(attributes)
  }

  const updateSavedColumnSettings = async allColumnSettings => {
    const { namespace, name } = workspaceId
    await Ajax(signal).Workspaces.workspace(namespace, name).shallowMergeNewAttributes({
      // Store settings as a string since Rawls expects lists of objects to be entity references
      [savedColumnSettingsWorkspaceAttributeName]: JSON.stringify(allColumnSettings)
    })
  }

  const getSavedColumnSettings = async () => {
    const allSavedColumnSettings = await getAllSavedColumnSettings()
    const columnSettingsForEntityType = _.getOr({}, entityTypeKey, allSavedColumnSettings)
    const entityTypeAttributes = entityMetadata[entityType].attributeNames

    return _.flow(
      _.mapValues(decodeColumnSettings),
      // Reconcile saved settings with any changes to entity type attributes
      _.mapValues(columnSettings => {
        return _.concat(
          // Remove columns that no longer exist on the entity type from settings
          _.filter(({ name }) => _.includes(name, entityTypeAttributes), columnSettings),
          // Add columns that were not in the saved settings
          _.flow(
            _.without(_.map(_.get('name'), columnSettings)),
            _.map(name => ({ name, visible: false }))
          )(entityTypeAttributes)
        )
      }),
      // Remove any settings that do not contain any existing columns
      _.pickBy(columnSettings => _.size(columnSettings) > 0)
    )(columnSettingsForEntityType)
  }

  const saveColumnSettings = async (columnSettingsName, columnSettings) => {
    // Re-fetch column settings to reduce the chances of overwriting changes made by other users since we first loaded settings.
    const allColumnSettings = await getAllSavedColumnSettings()
    const newColumnSettings = _.set(
      `${entityTypeKey}.${columnSettingsName}`,
      encodeColumnSettings(columnSettings),
      allColumnSettings
    )
    await updateSavedColumnSettings(newColumnSettings)
  }

  const deleteSavedColumnSettings = async columnSettingsName => {
    // Re-fetch column settings to reduce the chances of overwriting changes made by other users since we first loaded settings.
    const allColumnSettings = await getAllSavedColumnSettings()
    const newColumnSettings = _.omit(`${entityTypeKey}.${columnSettingsName}`, allColumnSettings)
    await updateSavedColumnSettings(newColumnSettings)
  }

  return {
    getSavedColumnSettings,
    saveColumnSettings,
    deleteSavedColumnSettings
  }
}

const SavedColumnSettings = ({ workspace, snapshotName, entityType, entityMetadata, columnSettings, onLoad }) => {
  const { workspace: { namespace, name } } = workspace
  const [loading, setLoading] = useState(true)
  const [savedColumnSettings, setSavedColumnSettings] = useState([])

  const {
    getSavedColumnSettings,
    saveColumnSettings,
    deleteSavedColumnSettings
  } = useSavedColumnSettings({ workspaceId: { namespace, name }, snapshotName, entityType, entityMetadata })

  useOnMount(() => {
    const loadSavedColumnSettings = _.flow(
      withErrorReporting('Error loading saved column settings'),
      withBusyState(setLoading)
    )(async () => {
      const savedColumnSettings = await getSavedColumnSettings()
      setSavedColumnSettings(savedColumnSettings)
    })
    loadSavedColumnSettings()
  })

  const [showSaveForm, setShowSaveForm] = useState(false)
  const settingsNameInput = useRef()
  useEffect(() => {
    if (showSaveForm) {
      settingsNameInput.current.focus()
    }
  }, [showSaveForm])
  const [selectedSettingsName, setSelectedSettingsName] = useState('')

  const save = _.flow(
    withErrorReporting('Error saving column settings'),
    withBusyState(setLoading)
  )(async settingsName => {
    await saveColumnSettings(settingsName, columnSettings)
    setSavedColumnSettings(_.set(settingsName, columnSettings))
    Ajax().Metrics.captureEvent(Events.dataTableSaveColumnSettings)
  })

  const load = settingsName => {
    onLoad(savedColumnSettings[settingsName])
    setSelectedSettingsName(settingsName)
    Ajax().Metrics.captureEvent(Events.dataTableLoadColumnSettings)
  }

  const del = _.flow(
    withErrorReporting('Error deleting column settings'),
    withBusyState(setLoading)
  )(async settingsName => {
    await deleteSavedColumnSettings(settingsName)
    setSavedColumnSettings(_.omit(settingsName))
    setSelectedSettingsName('')
  })

  const selectedSettingsNameExists = _.has(selectedSettingsName, savedColumnSettings)
  const editWorkspaceErrorMessage = workspace ? editWorkspaceError(workspace) : undefined
  const canSaveSettings = workspace && !editWorkspaceErrorMessage

  return div({ style: { display: 'flex', flexDirection: 'column', height: '100%' } }, [
    div(showSaveForm ? [
      p({ style: { marginTop: 0 } }, 'Save this column selection'),
      h(IdContainer, [id => h(Fragment, [
        h(FormLabel, { htmlFor: id }, 'Column selection name'),
        h(AutocompleteTextInput, {
          ref: settingsNameInput,
          id,
          openOnFocus: true,
          placeholderText: 'Enter a name for selection',
          onPick: setSelectedSettingsName,
          placeholder: 'Enter a name for selection',
          value: selectedSettingsName,
          onChange: setSelectedSettingsName,
          suggestions: _.flow(
            _.keys,
            selectedSettingsName ? _.concat(selectedSettingsName) : _.identity,
            _.sortBy(_.identity),
            _.sortedUniq
          )(savedColumnSettings),
          style: { fontSize: 16, marginBottom: '1rem' }
        })
      ])]),
      p({ style: { marginTop: 0 } }, 'This column selection will be shared with all users of this workspace.'),
      h(ButtonOutline, {
        disabled: !selectedSettingsName,
        tooltip: cond(
          [!selectedSettingsName, () => 'Enter a name to save column selection'],
          [selectedSettingsNameExists, () => 'Update this column selection'],
          () => 'Save this column selection'
        ),
        onClick: () => {
          save(selectedSettingsName)
        }
      }, selectedSettingsNameExists ? 'Update' : 'Save')
    ] : [
      h(ButtonOutline, {
        disabled: !canSaveSettings,
        tooltip: editWorkspaceErrorMessage,
        onClick: () => { setShowSaveForm(true) }
      }, 'Save this column selection')
    ]),

    hr({ style: { margin: '1rem 0' } }),

    _.size(savedColumnSettings) > 0 && h(Fragment, [
      p({ style: { marginTop: 0 } }, 'Your saved column selections:'),
      div({ style: { flex: '1 1 0', overflow: 'auto', paddingRight: '1rem' } }, [
        ul({ style: { padding: 0, margin: 0 } }, [
          _.flow(
            _.keys,
            _.sortBy(_.identity),
            _.map(settingsName => {
              return li({
                key: settingsName,
                style: { listStyleType: 'none', marginBottom: '0.5rem' }
              }, [
                span({ style: { display: 'inline-flex', width: '100%' } }, [
                  h(TooltipTrigger, { content: settingsName }, [
                    span({ style: { ...noWrapEllipsis } }, settingsName)
                  ]),
                  h(MenuTrigger, {
                    closeOnClick: true,
                    'aria-label': 'Column selection menu',
                    content: h(Fragment, [
                      h(MenuButton, { onClick: () => { load(settingsName) } }, 'Load'),
                      h(MenuButton, { onClick: () => { del(settingsName) } }, 'Delete')
                    ]),
                    side: 'bottom'
                  }, [
                    h(Clickable, {
                      'aria-label': 'Column selection menu',
                      style: { color: colors.accent(), marginLeft: '1ch' }
                    }, [icon('cardMenuIcon')])
                  ])
                ])
              ])
            })
          )(savedColumnSettings)
        ])
      ])
    ]),

    loading && spinnerOverlay
  ])
}

export const ColumnSettingsWithSavedColumnSettings = ({ columnSettings, onChange, ...otherProps }) => {
  return div({ style: { display: 'flex', justifyContent: 'space-between' } }, [
    div({ style: { width: 'calc(50% - 1rem)' } }, [
      h(ColumnSettings, {
        columnSettings,
        onChange
      })
    ]),
    div({ style: { width: 'calc(50% - 1rem)', marginTop: '2rem' } }, [
      h(SavedColumnSettings, {
        ...otherProps,
        columnSettings,
        onLoad: onChange
      })
    ])
  ])
}