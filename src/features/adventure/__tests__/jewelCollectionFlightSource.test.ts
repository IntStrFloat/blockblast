declare const __dirname: string;

const fs = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');

describe('Adventure jewel collection flight', () => {
  const layerSource = fs.readFileSync(
    `${__dirname}/../components/JewelCollectionFlightLayer.tsx`,
    'utf8',
  );
  const screenSource = fs.readFileSync(
    `${__dirname}/../../../app/adventure-level.tsx`,
    'utf8',
  );

  it('flies exact collected cells through an arc to the measured objective badge', () => {
    expect(layerSource).toContain('const collectedJewelCells = event?.collectedJewelCells ?? [];');
    expect(layerSource).toContain('collectedJewelCells.length === 0');
    expect(layerSource).toContain('cellIndexes: collectedJewelCells.slice(0, 3)');
    expect(layerSource).toContain('const visibleFlights = active.cellIndexes;');
    expect(layerSource).toContain('translateY: dy * 0.46 - lift');
    expect(layerSource).toContain('objectiveLayout.x + objectiveLayout.width / 2');
    expect(layerSource).toContain('<JewelIcon size={size} />');
  });

  it('measures the board and objective in the shared Adventure screen coordinate space', () => {
    expect(screenSource).toContain('setObjectiveLayout(event.nativeEvent.layout)');
    expect(screenSource).toContain('setObjectiveCounterLayout(event.nativeEvent.layout)');
    expect(screenSource).toContain('objectiveLayout.y + objectiveCounterLayout.y');
    expect(screenSource).toContain('setAdventureBoardLayout(event.nativeEvent.layout)');
    expect(screenSource).toContain('<JewelCollectionFlightLayer');
    expect(screenSource).toContain('boardOffset={BOARD_FRAME_WIDTH}');
    expect(screenSource).toContain('onArrive={setObjectiveArrival}');
    expect(screenSource).toContain('arrival={objectiveArrival}');
    expect(screenSource).toContain('key={`objective:${activeAdventureRunId}`}');
    expect(screenSource).toContain('key={`flight:${activeAdventureRunId}`}');
  });

  it('queues fast collections, aggregates overflow, and short-circuits reduced motion', () => {
    expect(layerSource).toContain('MAX_JEWEL_FLIGHT_QUEUE = 4');
    expect(layerSource).toContain('enqueueJewelFlight');
    expect(layerSource).toContain('delta: tail.delta + next.delta');
    expect(layerSource).toContain('if (reducedMotion)');
    expect(layerSource).toContain('wait_ms: 0');
  });
});
