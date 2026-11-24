-- The health form no longer asks for a drawn signature: agreement is the ticked
-- waiver and the typed name. Declarations signed before keep their image.

-- AlterTable
ALTER TABLE "HealthDeclaration" ALTER COLUMN "signature" DROP NOT NULL;
