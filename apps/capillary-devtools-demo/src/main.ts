import {TraceInspector} from '@capillaryjs/capillary-devtools/views/TraceInspector'
import {mountDemo} from './harness.js'

mountDemo(({recorder, selection, playback}) => new TraceInspector({recording: recorder, selection, playback}))
