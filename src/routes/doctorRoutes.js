const express = require('express');
const router = express.Router();
const doc = require('../controllers/digitalDoctorController');

function routeBoth(path, handler) {
  router.get(path, handler);
  router.post(path, handler);
}

// ── Initial Assessment (Pages 1-3) ──
routeBoth('/assessment/list', doc.listInitialAssessments);
routeBoth('/assessment/save', doc.saveInitialAssessment);
routeBoth('/assessment/delete', doc.deleteInitialAssessment);

// ── Consultant Progress Notes (Page 4) ──
routeBoth('/notes/list', doc.listProgressNotes);
routeBoth('/notes/save', doc.saveProgressNotes);
routeBoth('/notes/delete', doc.deleteProgressNotes);

// ── Cross Reference Visit Notes (Pages 5-6) ──
routeBoth('/cross-reference/list', doc.listCrossReferences);
routeBoth('/cross-reference/save', doc.saveCrossReference);
routeBoth('/cross-reference/delete', doc.deleteCrossReference);

// ── Medical Officer Handover Sheet (Page 7) ──
routeBoth('/mo-handover/list', doc.listMoHandovers);
routeBoth('/mo-handover/save', doc.saveMoHandover);
routeBoth('/mo-handover/delete', doc.deleteMoHandover);

// ── Doctor SBAR Handover (Page 8) ──
routeBoth('/sbar/list', doc.listSbarHandovers);
routeBoth('/sbar/save', doc.saveSbarHandover);
routeBoth('/sbar/delete', doc.deleteSbarHandover);

// ── Blood Transfusion & Adverse Reaction (Page 9) ──
routeBoth('/blood-transfusion/list', doc.listBloodTransfusions);
routeBoth('/blood-transfusion/save', doc.saveBloodTransfusion);
routeBoth('/blood-transfusion/delete', doc.deleteBloodTransfusion);

// ── Printable NABH Forms (All 9 pages) ──
router.get('/print/:formType', doc.printPdf);

module.exports = router;

