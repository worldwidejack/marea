-- M1 Fetta 1: ogni persona ha uno slot di lotto 0-7 nell'arcipelago (CONTRACTS §11). NULL = nessun lotto (arriva al Porto).
-- Le persone già esistenti prendono gli slot in ordine di creazione (a pari data, di inserimento); dalla nona in poi niente slot.
ALTER TABLE persone ADD COLUMN slot INTEGER CHECK (slot IS NULL OR (slot BETWEEN 0 AND 7));
UPDATE persone SET slot = (
  SELECT CASE WHEN n <= 7 THEN n END FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY creato, rowid) - 1 AS n FROM persone) AS r WHERE r.id = persone.id
);
CREATE UNIQUE INDEX persone_slot ON persone (slot) WHERE slot IS NOT NULL;
