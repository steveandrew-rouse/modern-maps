import demoData from '../../data/demo_data.json'
import type { DemoEvent, Layer } from './types'

// Bundled copy of the synthetic fixtures, used when the local API is not reachable.
export const LOCAL_LAYERS = demoData.layers as Layer[]
export const LOCAL_EVENTS = demoData.events as DemoEvent[]

/**
 * Offline counterpart of the API's transparent rule-based analyst placeholder.
 * It never claims to be a language model or to have live evidence.
 */
export function localAnalystAnswer(question: string): string {
  const q = question.toLowerCase()
  let focus =
    'A production analyst should retrieve relevant verified datasets, compare timestamps and geographic coverage, cite every source, and report uncertainty before making a recommendation.'
  if (/(flood|rain|cyclone|disaster)/.test(q)) {
    focus =
      'For a real hazard assessment, ingest timestamped official warnings and hydrology observations, verify the affected geography, and display the issuing agency and validity window.'
  } else if (/(traffic|road|rail|metro|transport)/.test(q)) {
    focus =
      'For transport analysis, connect an authorized traffic or transit feed, normalize its update cadence, and compare observations with a documented historical baseline.'
  } else if (/(energy|power|grid)/.test(q)) {
    focus =
      'For grid analysis, use utility-authorized aggregate telemetry and clearly distinguish measured load, estimates and simulated stress tests.'
  }
  return (
    'This demonstration build is not connected to live national datasets or a language model. ' +
    'The current map contains synthetic scenarios only. ' +
    focus
  )
}
