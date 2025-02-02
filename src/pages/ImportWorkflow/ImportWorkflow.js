import _ from 'lodash/fp';
import { Fragment, useState } from 'react';
import { div, h, h2, label } from 'react-hyperscript-helpers';
import { DeleteConfirmationModal, IdContainer, spinnerOverlay } from 'src/components/common';
import FooterWrapper from 'src/components/FooterWrapper';
import { icon } from 'src/components/icons';
import { ValidatedInput } from 'src/components/input';
import TopBar from 'src/components/TopBar';
import WDLViewer from 'src/components/WDLViewer';
import importBackground from 'src/images/hex-import-background.svg';
import { Ajax } from 'src/libs/ajax';
import colors from 'src/libs/colors';
import { withErrorReporting } from 'src/libs/error';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { workflowNameValidation } from 'src/libs/workflow-utils';
import validate from 'validate.js';

import { importDockstoreWorkflow } from './importDockstoreWorkflow';
import { useDockstoreWdl } from './useDockstoreWdl';
import { WorkspaceImporter } from './WorkspaceImporter';

const styles = {
  container: {
    display: 'flex',
    alignItems: 'flex-start',
    flex: 'auto',
    backgroundImage: `url(${importBackground})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: '1825px',
    backgroundPosition: 'left 745px top -90px',
    position: 'relative',
    padding: '2rem',
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    color: colors.dark(),
    margin: '0 0 1rem 0',
  },
  card: {
    ...Style.elements.card.container,
    borderRadius: 8,
    padding: '2rem',
    flex: 1,
    minWidth: 0,
    boxShadow: '0 1px 5px 0 rgba(0,0,0,0.26), 0 2px 10px 0 rgba(0,0,0,0.16)',
  },
};

export const ImportWorkflow = ({ path, version, source }) => {
  const [isBusy, setIsBusy] = useState(false);
  const [confirmOverwriteInWorkspace, setConfirmOverwriteInWorkspace] = useState();
  const [workflowName, setWorkflowName] = useState(_.last(path.split('/')));

  const { wdl, status: wdlStatus } = useDockstoreWdl({ path, version, isTool: source === 'dockstoretools' });

  const doImport = _.flow(
    Utils.withBusyState(setIsBusy),
    withErrorReporting('Error importing workflow')
  )(async (workspace, options = {}) => {
    const { name, namespace } = workspace;
    const eventData = { source, ...extractWorkspaceDetails(workspace) };

    setConfirmOverwriteInWorkspace(undefined);
    try {
      await importDockstoreWorkflow(
        {
          workspace,
          workflow: { path, version, source },
          workflowName,
        },
        options
      );
      Ajax().Metrics.captureEvent(Events.workflowImport, { ...eventData, success: true });
      Nav.goToPath('workflow', { namespace, name, workflowNamespace: namespace, workflowName });
    } catch (error) {
      if (error.status === 409) {
        setConfirmOverwriteInWorkspace(workspace);
      } else {
        Ajax().Metrics.captureEvent(Events.workflowImport, { ...eventData, success: false });
        throw error;
      }
    }
  });

  const errors = validate({ workflowName }, { workflowName: workflowNameValidation() });

  return div({ style: styles.container }, [
    div({ style: { ...styles.card, maxWidth: 740 } }, [
      h2({ style: styles.title }, ['Importing from Dockstore']),
      div({ style: { fontSize: 18 } }, [path]),
      div({ style: { fontSize: 13, color: colors.dark() } }, [`V. ${version}`]),
      div(
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            margin: '1rem 0',
            color: colors.warning(2.35), // Just barely 4.5:1 contrast
          },
        },
        [
          icon('warning-standard', { title: 'Warning', size: 32, style: { marginRight: '0.5rem', flex: 'none' } }),
          'Please note: Dockstore cannot guarantee that the WDL and Docker image referenced ',
          'by this Workflow will not change. We advise you to review the WDL before future runs.',
        ]
      ),
      wdl && h(WDLViewer, { wdl, style: { height: 500 } }),
    ]),
    div({ style: { ...styles.card, margin: '0 2.5rem', maxWidth: 430 } }, [
      h(IdContainer, [
        (id) =>
          h(Fragment, [
            label({ htmlFor: id, style: { ...styles.title } }, 'Workflow Name'),
            h(ValidatedInput, {
              inputProps: {
                id,
                onChange: setWorkflowName,
                value: workflowName,
              },
              error: Utils.summarizeErrors(errors),
            }),
          ]),
      ]),
      h(IdContainer, [
        (id) =>
          h(Fragment, [
            label({ htmlFor: id, style: { ...styles.title, paddingTop: '2rem' } }, ['Destination Workspace']),
            h(WorkspaceImporter, {
              additionalErrors: errors,
              id,
              onImport: (workspace) => doImport(workspace, { overwrite: false }),
            }),
          ]),
      ]),
      (wdlStatus === 'Loading' || isBusy) && spinnerOverlay,
    ]),

    !!confirmOverwriteInWorkspace &&
      h(
        DeleteConfirmationModal,
        {
          title: 'Overwrite existing workflow?',
          buttonText: 'Overwrite',
          onConfirm: () => doImport(confirmOverwriteInWorkspace, { overwrite: true }),
          onDismiss: () => setConfirmOverwriteInWorkspace(undefined),
        },
        [`The selected workspace already contains a workflow named "${workflowName}". Are you sure you want to overwrite it?`]
      ),
  ]);
};

const ImportWorkflowPage = ({ source, item }) => {
  const [path, version] = item.split(':');

  return h(FooterWrapper, [
    h(TopBar, { title: 'Import Workflow' }),
    div({ role: 'main', style: { flexGrow: 1 } }, [
      Utils.cond(
        [source === 'dockstore' || source === 'dockstoretools', () => h(ImportWorkflow, { path, version, source })],
        () => `Unknown source '${source}'`
      ),
    ]),
  ]);
};

export const navPaths = [
  {
    name: 'import-workflow',
    path: '/import-workflow/:source/:item(.*)',
    component: ImportWorkflowPage,
    encode: _.identity,
    title: 'Import Workflow',
  },
  {
    name: 'import-tool', // legacy
    path: '/import-tool/:source/:item(.*)',
    encode: _.identity,
    component: (props) => h(Nav.Redirector, { pathname: Nav.getPath('import-workflow', props) }),
  },
];
