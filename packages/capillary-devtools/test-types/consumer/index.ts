import {TraceRecorder, TraceSelection, TracePlayback, TraceInspector} from '@capillaryjs/capillary-devtools'
import {filterTrace} from '@capillaryjs/capillary-devtools/model'
import {FlowGraphView} from '@capillaryjs/capillary-devtools/views/FlowGraphView'
const recorder = new TraceRecorder({capture: 'formatter', formatter: (_value, {field}) => field})
const selection = new TraceSelection()
const playback = new TracePlayback()
new TraceInspector({recording: recorder, selection, playback})
new FlowGraphView({recording: recorder.snapshot(), selection})
filterTrace(recorder.snapshot(), {sourceId: 'node-1', targetId: 'node-2'})
