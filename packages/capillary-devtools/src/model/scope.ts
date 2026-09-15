import {DiagnosticScope} from '@capillaryjs/capillary'

/** All tool-owned models and rendered descendants use this excluded scope. */
export const devtoolsDiagnosticScope = new DiagnosticScope('Capillary DevTools', false)
