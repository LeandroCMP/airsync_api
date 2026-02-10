import { ClientSession, Connection } from 'mongoose';

function isTransactionNotSupported(error: any): boolean {
  if (!error) return false;
  if (error.code === 20) {
    return true;
  }
  const message: string = error.message || '';
  return (
    message.includes('Transaction numbers are only allowed on a replica set member') ||
    message.includes('Transactions are not supported')
  );
}

export async function executeWithTransactionIfSupported<T>(
  connection: Connection,
  handler: (session: ClientSession | null) => Promise<T>
): Promise<T> {
  const session = await connection.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await handler(session);
    });
    await session.endSession();
    return result as T;
  } catch (error) {
    await session.endSession();
    if (isTransactionNotSupported(error)) {
      return handler(null);
    }
    throw error;
  }
}
