import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/airsync';

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const collection = db.collection('financetransactions');

  const duplicates = await collection
    .aggregate([
      { $group: { _id: { tenantId: '$tenantId', ref: '$ref' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } }
    ])
    .toArray();

  if (!duplicates.length) {
    console.log('Nenhum ref duplicado encontrado.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Encontrados ${duplicates.length} refs duplicados. Removendo excedentes (mantendo o mais recente).`);

  for (const dup of duplicates) {
    const ids: any[] = dup.ids || [];
    if (ids.length <= 1) continue;
    // Mantém o maior _id (mais recente) e remove os demais
    ids.sort((a, b) => (a > b ? -1 : 1));
    const keep = ids[0];
    const toDelete = ids.slice(1);
    if (!toDelete.length) continue;
    const res = await collection.deleteMany({ _id: { $in: toDelete } });
    console.log(
      `tenant=${dup._id?.tenantId} ref=${dup._id?.ref} | mantido=${keep} | removidos=${res.deletedCount}`
    );
  }

  await mongoose.disconnect();
  console.log('Concluído.');
}

main().catch((err) => {
  console.error('Erro ao limpar duplicados de ref:', err);
  process.exit(1);
});
