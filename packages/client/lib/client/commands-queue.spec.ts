import { strict as assert } from 'node:assert';
import RedisCommandsQueue from './commands-queue';

describe('RedisCommandsQueue', () => {
  function createQueue() {
    return new RedisCommandsQueue(3, null, () => {}, 'test');
  }

  it('extracts a queued chain as a unit', () => {
    const queue = createQueue();
    const chainId = Symbol('chain');

    queue.addCommand(['MULTI'], { chainId, slotNumber: 1 });
    queue.addCommand(['SET', 'key', 'value'], { chainId, slotNumber: 1 });
    queue.addCommand(['EXEC'], { chainId, slotNumber: 1 });

    const commands = queue.extractCommandsForSlots(new Set([1]));

    assert.deepEqual(
      commands.map(command => command.args),
      [['MULTI'], ['SET', 'key', 'value'], ['EXEC']]
    );
    assert.equal(queue.isWaitingToWrite(), false);
  });

  it('extracts regular commands before any chain starts writing', () => {
    const queue = createQueue();

    queue.addCommand(['GET', 'key'], { slotNumber: 1 });

    const commands = queue.extractCommandsForSlots(new Set([1]));

    assert.deepEqual(commands.map(command => command.args), [['GET', 'key']]);
  });

  it('does not extract the remaining part of a chain that has started writing', () => {
    const queue = createQueue();
    const chainId = Symbol('chain');

    queue.addCommand(['MULTI'], { chainId, slotNumber: 1 });
    queue.addCommand(['SET', 'key', 'value'], { chainId, slotNumber: 1 });
    queue.addCommand(['EXEC'], { chainId, slotNumber: 1 });

    const writer = queue.commandsToWrite();
    writer.next();

    assert.deepEqual(queue.extractCommandsForSlots(new Set([1])), []);
    assert.equal(queue.isWaitingToWrite(), true);
  });

  it('does not extract an in-flight chain during a full queue handoff', () => {
    const queue = createQueue();
    const chainId = Symbol('chain');

    queue.addCommand(['MULTI'], { chainId, slotNumber: 1 });
    queue.addCommand(['SET', 'key', 'value'], { chainId, slotNumber: 1 });
    queue.addCommand(['EXEC'], { chainId, slotNumber: 1 });

    const writer = queue.commandsToWrite();
    writer.next();

    assert.deepEqual(queue.extractAllCommands(), []);
    assert.equal(queue.isWaitingToWrite(), true);
  });
});
