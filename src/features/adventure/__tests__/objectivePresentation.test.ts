import {
  MAX_JEWEL_FLIGHT_QUEUE,
  enqueueJewelFlight,
  type FlightBatch,
} from '../components/JewelCollectionFlightLayer';

function batch(id: string, delta: number, total: number, cells: number[]): FlightBatch {
  return {
    presentationId: id,
    cellIndexes: cells,
    delta,
    total,
    queuedAtMs: total * 10,
  };
}

describe('Adventure objective presentation queue', () => {
  it('keeps two collections that arrive faster than the old 430ms HUD delay', () => {
    const first = batch('run:1', 1, 1, [8]);
    const second = batch('run:2', 2, 3, [16, 17]);

    expect(enqueueJewelFlight(enqueueJewelFlight([], first), second)).toEqual([first, second]);
  });

  it('bounds the queue and aggregates overflow without losing the durable total', () => {
    let queue: FlightBatch[] = [];
    for (let index = 1; index <= MAX_JEWEL_FLIGHT_QUEUE + 2; index += 1) {
      queue = enqueueJewelFlight(queue, batch(`run:${index}`, 1, index, [index, index + 8]));
    }

    expect(queue).toHaveLength(MAX_JEWEL_FLIGHT_QUEUE);
    expect(queue.at(-1)).toMatchObject({
      presentationId: 'run:4+run:5+run:6',
      delta: 3,
      total: 6,
    });
    expect(queue.at(-1)!.cellIndexes).toHaveLength(3);
  });
});
