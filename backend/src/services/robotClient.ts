/**
 * Thin TCP client for streaming UR programs to a Universal Robots controller. The client
 * intentionally keeps a minimal state surface, focusing on connection orchestration and error
 * propagation so higher-level workflows can decide how to react.
 */
import net from 'net';
import { config } from '../config';

/**
 * Sends a UR program to the configured robot, resolving once the socket is closed.
 *
 * @param program Fully formatted URScript program string to transmit to the robot.
 * @returns A promise that resolves when the TCP socket closes or rejects if the delivery fails.
 */
export async function sendProgramToRobot(program: string): Promise<void> {
  if (!config.robot.enabled) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const client = new net.Socket();

    client.once('error', (error) => {
      client.destroy();
      reject(error);
    });

    client.connect(config.robot.port, config.robot.host, () => {
      client.write(`${program}\n`, 'utf8', (writeError) => {
        if (writeError) {
          client.destroy();
          reject(writeError);
          return;
        }

        client.end();
      });
    });

    client.once('close', () => resolve());
  });
}
