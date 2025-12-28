import dbConnect from '@/server/db/mongoose';
import { getDefaultBsCoordinateModel, BsCoordinate as IBaseStation } from '@/server/models/BsCoordinateModel';
import mongoose from 'mongoose';

async function cleanDuplicates() {
  try {
    await dbConnect();
    console.log('Connected to database');

    const BaseStation = getDefaultBsCoordinateModel();
    const duplicates = await BaseStation.aggregate<{
      _id: string;
      docs: IBaseStation[];
      count: number;
    }>([
      { $match: { name: { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: '$name',
          docs: { $push: '$$ROOT' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]);

    console.log(`Found ${duplicates.length} duplicate groups`);

    for (const group of duplicates) {
      const idsToDelete = group.docs
        .slice(1)
        .map((doc: IBaseStation) =>
          (doc._id as mongoose.Types.ObjectId).toString()
        );

      await BaseStation.deleteMany({ _id: { $in: idsToDelete } });
      console.log(`Deleted ${idsToDelete.length} duplicates for ${group._id}`);
    }

    console.log('Duplicate cleaning completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during cleaning:', error);
    process.exit(1);
  }
}

cleanDuplicates();
