import net from 'net';
import { config } from '../config';
import { recordProgress } from './progressStore';

export const startProgressSocketServer = () => {
  const server = net.createServer((socket) => {
    let buffer = '';

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');

      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const raw = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf('\n');

        if (!raw) {
          continue;
        }

        try {
          let rawFixed = "";
          if (raw.indexOf("}") > 0) {
            rawFixed = raw.replace("jobId:", `"jobId":"`).replace(",current", `","current"`).replace("total", `"total"`);

          }
          const payload = JSON.parse(rawFixed) as { jobId?: string; current?: number; total?: number };
          if (
            typeof payload.jobId === 'string' &&
            Number.isFinite(payload.current) &&
            Number.isFinite(payload.total)
          ) {
            console.log(payload);
            recordProgress(payload.jobId, Number(payload.current), Number(payload.total));
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to parse robot progress payload:', raw, error);
        }
      }
    });

    socket.on('error', (error) => {
      // eslint-disable-next-line no-console
      console.error('Progress socket connection error:', error);
    });
  });

  server.listen(config.robot.progressPort, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`Progress socket server listening on port ${config.robot.progressPort}`);
  });

  server.on('error', (error) => {
    // eslint-disable-next-line no-console
    console.error('Progress socket server error:', error);
  });
};
