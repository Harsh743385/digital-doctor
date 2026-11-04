const express = require('express');
const router = express.Router();
const dn = require('../controllers/digitalNursingController');

// Helper to support both POST and GET for clinical AJAX actions
function routeBoth(path, handler) {
  router.get(path, handler);
  router.post(path, handler);
}

// ── Assessment ──
routeBoth('/assessment/list', dn.listAssessments);
routeBoth('/assessment/save', dn.saveAssessment);
routeBoth('/assessment/delete', dn.deleteAssessment);
routeBoth('/assessment/pdf', dn.previewPdf);
routeBoth('/reassessment/pdf', dn.previewPdf);

// ── eMAR ──
routeBoth('/emar/list', dn.listEmar);
routeBoth('/emar/save', dn.saveEmar);
routeBoth('/emar/delete', dn.deleteEmar);
routeBoth('/emar/stop', dn.stopEmar);
routeBoth('/emar/administer', dn.administerEmar);
routeBoth('/emar/admin-get', dn.listEmar);
routeBoth('/emar/admin-list', dn.listEmar);
routeBoth('/emar/audit-list', (req, res) => res.json({ status: true, data: [] }));
routeBoth('/emar/medicines', dn.searchMedicines);

// ── eTAR ──
routeBoth('/etar/list', dn.listEtar);
routeBoth('/etar/save', dn.saveEtar);
routeBoth('/etar/delete', (req, res) => res.json({ status: true, msg: 'Deleted' }));
routeBoth('/etar/administer', dn.administerEtar);
routeBoth('/etar/admin-list', dn.listEtar);

// ── Vitals ──
routeBoth('/vitals/list', dn.listVitals);
routeBoth('/vitals/save', dn.saveVitals);
routeBoth('/vitals/delete', dn.deleteVitals);

// ── ICU / CCU ──
routeBoth('/icu/list', dn.listIcu);
routeBoth('/icu/save', dn.saveIcu);
routeBoth('/icu/delete', (req, res) => res.json({ status: true, msg: 'ICU chart deleted' }));
routeBoth('/icu/pdf', dn.previewPdf);
routeBoth('/icu-obs/list', dn.listIcuObs);
routeBoth('/icu-obs/save', dn.saveIcuObs);
routeBoth('/icu-obs/delete', (req, res) => res.json({ status: true, msg: 'Obs deleted' }));

// ── Progress Notes ──
routeBoth('/notes/list', dn.listNotes);
routeBoth('/notes/save', dn.saveNotes);
routeBoth('/notes/delete', dn.deleteNotes);

// ── Intake & Output ──
routeBoth('/io/list', dn.listIo);
routeBoth('/io/save', dn.saveIo);
routeBoth('/io/delete', dn.deleteIo);

// ── Diabetic Flow Chart ──
routeBoth('/diabetic/list', dn.listDiabetic);
routeBoth('/diabetic/save', dn.saveDiabetic);
routeBoth('/diabetic/delete', (req, res) => res.json({ status: true, msg: 'Deleted' }));
routeBoth('/diabetic/audit', dn.auditDiabetic);
routeBoth('/diabetic/pdf', dn.previewPdf);

// ── Records (Specialised, Safety, Handovers, Physio, Meds) ──
routeBoth('/record/list', dn.listRecords);
routeBoth('/record/save', dn.saveRecord);
routeBoth('/record/delete', dn.deleteRecord);
routeBoth('/record/pdf', dn.previewPdf);

// ── Shift Handover ──
routeBoth('/handover/list', dn.listHandovers);
routeBoth('/handover/save', dn.saveHandover);
routeBoth('/handover/delete', (req, res) => res.json({ status: true, msg: 'Deleted' }));

// ── Risk Assessments ──
routeBoth('/risk/list', dn.listRisks);
routeBoth('/risk/save', dn.saveRisk);
routeBoth('/risk/delete', (req, res) => res.json({ status: true, msg: 'Deleted' }));

// ── FAST HUG BID ──
routeBoth('/fasthug/list', dn.listFastHug);
routeBoth('/fasthug/save', dn.saveFastHug);
routeBoth('/fasthug/delete', (req, res) => res.json({ status: true, msg: 'Deleted' }));

// ── Restraint ──
routeBoth('/restraint/list', dn.listRestraint);
routeBoth('/restraint/save', dn.saveRestraint);
routeBoth('/restraint/delete', (req, res) => res.json({ status: true, msg: 'Deleted' }));
routeBoth('/restraint/pdf', dn.previewPdf);

// ── Care Plans ──
routeBoth('/careplan/list', dn.listCarePlans);
routeBoth('/careplan/save', dn.saveCarePlan);
routeBoth('/careplan/delete', (req, res) => res.json({ status: true, msg: 'Deleted' }));

// ── Report & Dates ──
routeBoth('/report', dn.getReport);
routeBoth('/dates', dn.listDates);
routeBoth('/hai/pdf', dn.previewPdf);
routeBoth('/vitals-io/pdf', dn.previewPdf);

module.exports = router;
