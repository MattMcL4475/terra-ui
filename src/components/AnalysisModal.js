import _ from 'lodash/fp'
import { Fragment, useState } from 'react'
import { div, h, h2, hr, img, span } from 'react-hyperscript-helpers'
import { ButtonPrimary, IdContainer, Select, spinnerOverlay, WarningTitle } from 'src/components/common'
import { ComputeModalBase } from 'src/components/ComputeModal'
import Dropzone from 'src/components/Dropzone'
import { GalaxyModalBase } from 'src/components/GalaxyModal'
import { icon } from 'src/components/icons'
import ModalDrawer from 'src/components/ModalDrawer'
import { analysisNameInput, analysisNameValidator, getDisplayName, getTool, notebookData, tools } from 'src/components/notebook-utils'
import TitleBar from 'src/components/TitleBar'
import galaxyLogo from 'src/images/galaxy-logo.png'
import jupyterLogoLong from 'src/images/jupyter-logo-long.png'
import rstudioLogo from 'src/images/rstudio-logo.svg'
import { Ajax } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { reportError, withErrorReporting } from 'src/libs/error'
import { FormLabel } from 'src/libs/forms'
import { getCurrentApp, getCurrentRuntime, isResourceDeletable } from 'src/libs/runtime-utils'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import validate from 'validate.js'


const titleId = 'analysis-modal-title'
const analysisMode = Symbol('artifact')
const environmentMode = Symbol('environment')

export const AnalysisModal = Utils.withDisplayName('AnalysisModal')(
  ({
    isOpen, onDismiss, onSuccess, uploadFiles, openUploader, runtimes, apps, galaxyDataDisks, refreshRuntimes, refreshApps, refreshAnalyses,
    analyses, workspace, persistentDisks, workspace: { workspace: { namespace, bucketName, name: workspaceName } }
  }) => {
    const [viewMode, setViewMode] = useState(undefined)
    const [busy, setBusy] = useState()
    const [notebookKernel, setNotebookKernel] = useState('python3')
    const [analysisName, setAnalysisName] = useState('')
    const prevAnalysisName = Utils.usePrevious(analysisName)
    const [currentTool, setCurrentTool] = useState(undefined)

    const currentRuntime = getCurrentRuntime(runtimes)
    const currentRuntimeTool = currentRuntime?.labels?.tool
    const currentApp = getCurrentApp(apps)

    const resetView = () => {
      setViewMode(undefined)
      setAnalysisName('')
      setCurrentTool(undefined)
      setNotebookKernel('python3')
    }

    /**
     * The intended flow is to call this without a viewMode, and have it intelligently figure out the next
     * step for you. Passing a viewMode is a way to force your next modal.
     */
    const enterNextViewMode = (currentTool, baseViewMode = viewMode) => {
      const doesCloudEnvForToolExist = currentRuntimeTool === currentTool || (currentApp && currentTool === tools.galaxy.label)

      Utils.switchCase(baseViewMode,
        [analysisMode, () => Utils.cond(
          [doesCloudEnvForToolExist, () => {
            resetView()
            onSuccess()
          }],
          [!doesCloudEnvForToolExist && currentRuntime && isResourceDeletable('runtime', currentRuntime), () => setViewMode(environmentMode)],
          [!doesCloudEnvForToolExist && !currentRuntime, () => setViewMode(environmentMode)],
          [!doesCloudEnvForToolExist && currentRuntime && !isResourceDeletable('runtime', currentRuntime), () => {
            resetView()
            onSuccess()
          }]
        )],
        [environmentMode, () => {
          resetView()
          onSuccess()
        }],
        [Utils.DEFAULT, () => Utils.cond(
          [currentTool === tools.RStudio.label || currentTool === tools.Jupyter.label, () => setViewMode(analysisMode)],
          [currentTool === tools.galaxy.label && !currentApp, () => setViewMode(environmentMode)],
          [currentTool === tools.galaxy.label && currentApp, () => {
            console.error(
              'This shouldn\'t be possible, as you aren\'t allowed to create a galaxy analysis when one exists; the button should be disabled.')
            resetView()
          }]
        )]
      )
    }

    const getView = () => Utils.switchCase(viewMode,
      [analysisMode, renderCreateAnalysis],
      [environmentMode, getEnvironmentView],
      [Utils.DEFAULT, renderSelectAnalysisBody])

    const getEnvironmentView = () => Utils.switchCase(currentTool,
      [tools.Jupyter.label, renderComputeModal],
      [tools.RStudio.label, renderComputeModal],
      [tools.galaxy.label, renderGalaxyModal]
    )

    const renderComputeModal = () => h(ComputeModalBase, {
      isOpen: currentTool === tools.Jupyter.label || currentTool === tools.RStudio.label,
      isAnalysisMode: true,
      workspace,
      tool: currentTool,
      runtimes,
      persistentDisks,
      onDismiss: () => {
        resetView()
        onDismiss()
      },
      onSuccess: _.flow(
        withErrorReporting('Error creating compute'),
        Utils.withBusyState(setBusy)
      )(async () => {
        setViewMode(undefined)
        onSuccess()
        await refreshRuntimes(true)
      })
    })

    const renderGalaxyModal = () => h(GalaxyModalBase, {
      isOpen: viewMode === tools.galaxy.label,
      isAnalysisMode: true,
      workspace,
      apps,
      galaxyDataDisks,
      onDismiss: () => {
        setViewMode(undefined)
        onDismiss()
      },
      onSuccess: _.flow(
        withErrorReporting('Error creating app'),
        Utils.withBusyState(setBusy)
      )(async () => {
        setViewMode(undefined)
        onSuccess()
        await refreshApps(true)
      })
    })

    const styles = {
      toolCard: {
        backgroundColor: 'white', borderRadius: 5, padding: '1rem', display: 'inline-block', verticalAlign: 'middle', marginBottom: '1rem',
        textAlign: 'center', width: '100%', height: 60
      },
      image: { verticalAlign: 'middle', height: '100%', width: '40%' }
    }

    const renderToolButtons = () => div({
      style: { display: 'flex', alignItems: 'center', flexDirection: 'column', justifyContent: 'space-between' }
    }, [
      div({
        style: styles.toolCard, onClick: () => {
          setCurrentTool(tools.Jupyter.label)
          enterNextViewMode(tools.Jupyter.label)
        }
      }, [img({ src: jupyterLogoLong, style: _.merge(styles.image, { width: '30%' }) })]),
      div({
        style: styles.toolCard, onClick: () => {
          setCurrentTool(tools.RStudio.label)
          enterNextViewMode(tools.RStudio.label)
        }
      }, [img({ src: rstudioLogo, style: styles.image })]),
      div({
        style: { opacity: currentApp ? '0.5' : '1', ...styles.toolCard }, onClick: () => {
          setCurrentTool(tools.galaxy.label)
          enterNextViewMode(tools.galaxy.label)
        }, disabled: !currentApp, title: currentApp ? 'You already have a galaxy environment' : ''
      }, [img({ src: galaxyLogo, style: _.merge(styles.image, { width: '30%' }) })])
    ])

    const renderSelectAnalysisBody = () => div({
      style: { display: 'flex', flexDirection: 'column', flex: 1, padding: '0.5rem 1.5rem 1.5rem 1.5rem' }
    }, [
      renderToolButtons(),
      h(Dropzone, {
        accept: `.${tools.Jupyter.ext}, .${tools.RStudio.ext}`,
        style: { flexGrow: 1, backgroundColor: colors.light(), height: '100%' },
        activeStyle: { backgroundColor: colors.accent(0.2), cursor: 'copy' },
        onDropRejected: () => reportError('Not a valid analysis file',
          'The selected file is not a .ipynb otebook file or an .Rmd rstudio file. Ensure your file has the proper extension.'),
        onDropAccepted: files => {
          const tool = getTool(files.pop().path)
          setCurrentTool(tool)
          currentRuntime && !isResourceDeletable('runtime', currentRuntime) && currentRuntimeTool !== tool ?
            onSuccess() :
            enterNextViewMode(tool, analysisMode)
          uploadFiles()
        }
      }, [() => div({
        onClick: () => {
          resetView()
          onSuccess()
          openUploader()
        }, style: {
          marginTop: '1rem', fontSize: 16, lineHeight: '20px', ...Style.elements.card.container, alignItems: 'center', width: '100%', height: 150,
          backgroundColor: colors.dark(0.1), border: `1px dashed ${colors.dark(0.7)}`, boxShadow: 'none'
        }
      }, [
        div(['Or Click / Drag to upload an analysis file']),
        icon('upload-cloud', { size: 25, style: { opacity: 0.4, marginTop: '0.5rem' } })
      ])])
    ])

    const getArtifactLabel = toolLabel => Utils.switchCase(toolLabel,
      [tools.RStudio.label, () => 'R markdown file'],
      [tools.Jupyter.label, () => 'notebook'],
      [Utils.DEFAULT, () => console.error(`Should not be calling getArtifactLabel for ${toolLabel}, artifacts not implemented`)])

    const renderCreateAnalysis = () => div({ style: { display: 'flex', flexDirection: 'column', flex: 1, padding: '0.5rem 1.5rem 1.5rem 1.5rem' } }, [
      h2({ style: { fontWeight: 600, marginBottom: 0 } }, [`Create a new ${getArtifactLabel(currentTool)}`]),
      renderCreateAnalysisBody(currentTool)
    ])

    const errors = validate(
      { analysisName, notebookKernel },
      {
        analysisName: analysisNameValidator(_.map(({ name }) => getDisplayName(name), analyses)),
        notebookKernel: { presence: { allowEmpty: true } }
      }
    )

    const renderCreateAnalysisBody = toolLabel => {
      const isJupyter = toolLabel === tools.Jupyter.label
      return div({ style: { display: 'flex', flexDirection: 'column' } }, [
        h(IdContainer, [id => h(Fragment, [
          h(FormLabel, { htmlFor: id, required: true }, [`Name of the ${getArtifactLabel(toolLabel)}`]),
          analysisNameInput({
            error: Utils.summarizeErrors(prevAnalysisName !== analysisName && errors?.analysisName),
            inputProps: {
              id, value: analysisName,
              onChange: v => {
                setAnalysisName(v)
              }
            }
          })
        ])]),
        isJupyter && h(IdContainer, [id => h(Fragment, [
          h(FormLabel, { htmlFor: id, required: true }, ['Language']),
          h(Select, {
            id, isSearchable: true,
            placeholder: 'Select a language',
            getOptionLabel: ({ value }) => _.startCase(value),
            value: notebookKernel,
            onChange: ({ value: notebookKernel }) => setNotebookKernel(notebookKernel),
            options: ['python3', 'r']
          })
        ])]),
        (isJupyter || toolLabel === tools.RStudio.label) &&
        (currentRuntime && !isResourceDeletable('runtime', currentRuntime) && currentRuntimeTool !== toolLabel) &&
        div({ style: { backgroundColor: colors.warning(0.1), margin: '0.5rem', padding: '1rem' } }, [
          h(WarningTitle, { iconSize: 16 }, [span({ style: { fontWeight: 600 } }, ['Environment Creation'])]),
          div({ style: { marginBottom: '0.5rem', marginTop: '1rem' } }, [
            'You have a non-deletable environment associated with another application.'
          ]),
          div([
            'You may create an analysis, but must wait for your current environment to finish processing and get a suitable environment to run it.'
          ])
        ]),
        div({ style: { display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' } }, [
          h(ButtonPrimary, {
            disabled: errors,
            tooltip: Utils.summarizeErrors(errors),
            onClick: async () => {
              try {
                const contents = isJupyter ? notebookData[notebookKernel] : '# Starter Rmd file'
                isJupyter ?
                  await Ajax().Buckets.notebook(namespace, bucketName, analysisName).create(contents) :
                  await Ajax().Buckets.analysis(namespace, bucketName, analysisName, toolLabel).create(contents)
                refreshAnalyses()
                setAnalysisName('')
                enterNextViewMode(toolLabel)
              } catch (error) {
                await reportError('Error creating analysis', error)
                onDismiss()
              }
            }
          }, 'Create Analysis')
        ])
      ])
    }

    const width = Utils.switchCase(viewMode,
      [environmentMode, () => 675],
      [analysisMode, () => 450],
      [Utils.DEFAULT, () => 450]
    )

    const modalBody = h(Fragment, [
      h(TitleBar, {
        id: titleId,
        title: 'Select an application',
        titleStyles: { margin: '1.5rem 0 0 1.5rem', display: !!viewMode ? 'none' : undefined },
        width,
        onDismiss: () => {
          resetView()
          onDismiss()
        },
        onPrevious: () => !!viewMode && resetView()
      }),
      viewMode !== undefined && hr({ style: { borderTop: '1px solid', width: '100%', color: colors.accent() } }),
      getView(),
      busy && spinnerOverlay
    ])

    const modalProps = {
      isOpen, width, 'aria-labelledby': titleId,
      onDismiss: () => {
        resetView()
        onDismiss()
      }
    }

    return h(ModalDrawer, { ...modalProps, children: modalBody })
  }
)