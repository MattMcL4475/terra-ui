import { div, h, label, strong } from 'react-hyperscript-helpers'
import { Link, Switch } from 'src/components/common'
import colors from 'src/libs/colors'
import { isDataBrowserVisible } from 'src/libs/config'
import * as Nav from 'src/libs/nav'
import { useStore } from 'src/libs/react-utils'
import { authStore } from 'src/libs/state'
import { catalogPreviewStore } from 'src/pages/library/dataBrowser-utils'


export const DataBrowserPreviewToggler = ({ checked }) => {
  const { user: { id } } = useStore(authStore)
  catalogPreviewStore.set({ [id]: checked })

  return !isDataBrowserVisible() ? div() : div({
    style: {
      background: colors.dark(0.1),
      padding: '10px 15px',
      margin: 15,
      border: '1px solid', borderColor: colors.accent(), borderRadius: 3,
      display: 'flex', flexDirection: 'row'
    }
  }, [
    div({ style: { display: 'flex', flexDirection: 'column' } }, [
      strong(['Toggle to preview the new Data Catalog']),
      label({
        role: 'link',
        style: { fontWeight: 'bold', display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 6 }
      }, [
        h(Switch, {
          checked,
          onLabel: '', offLabel: '',
          width: 55, height: 25,
          onChange: () => {
            catalogPreviewStore.set({ [id]: !checked })
            if (checked) {
              Nav.goToPath('library-datasets')
            } else {
              Nav.goToPath('library-browser')
            }
          }
        }),
        div({ style: { marginLeft: 10 } }, [`BETA Data Catalog ${checked ? 'ON' : 'OFF'}`])
      ])
    ]),
    checked && div({ style: { marginLeft: 80 } }, [
      'After previewing the Terra Data Catalog, please fill out this quick survey to provide the team with valuable feedback.',
      h(Link, {
        href: '#', // TODO: Add when this is added.
        style: { display: 'block', marginTop: 10 }
      }, ['BETA Terra Data Catalog survey'])
    ])
  ])
}
