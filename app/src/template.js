'use strict';
/* Standard folder template and document types. A new project starts from this, then is edited. */
const TYPE_ROWS = [
  ['PID', 'P&ID', 'controlled', 'EPC/02 Engineering/02.1 Process'],
  ['ISO', 'Piping isometric', 'controlled', 'EPC/02 Engineering/02.2 Piping'],
  ['SLD', 'Single line diagram', 'controlled', 'EPC/02 Engineering/02.3 Electrical'],
  ['MS', 'Method statement', 'controlled', 'EPC/04 Construction/04.1 Method Statements'],
  ['SOP', 'Startup procedure', 'controlled', 'Operations/02 SOPs'],
  ['MAN', 'Operations manual', 'controlled', 'Operations/01 Manuals'],
  ['MNT', 'Monthly maintenance check', 'periodic', 'Operations/03 Maintenance'],
  ['RPT', 'Monthly operations report', 'periodic', 'Operations/05 Reports'],
  ['CERT', 'Certificate or inspection', 'record', 'Operations/06 Certificates'],
  ['PTW', 'Permit to work template', 'record', 'Operations/04 Permits'],
];
const FOLDERS = [
  'EPC/01 Project Management',
  'EPC/02 Engineering/02.1 Process', 'EPC/02 Engineering/02.2 Piping', 'EPC/02 Engineering/02.3 Electrical',
  'EPC/02 Engineering/02.4 Instrumentation & Control', 'EPC/02 Engineering/02.5 Civil & Structural',
  'EPC/03 Procurement/03.1 Requisitions', 'EPC/03 Procurement/03.2 Purchase Orders', 'EPC/03 Procurement/03.3 Vendor Documents',
  'EPC/04 Construction/04.1 Method Statements', 'EPC/04 Construction/04.2 Inspection & Test Plans', 'EPC/04 Construction/04.3 Daily Reports',
  'EPC/05 Commissioning', 'EPC/06 Handover/06.1 As-Built', 'EPC/06 Handover/06.2 O&M Manuals',
  'Operations/01 Manuals', 'Operations/02 SOPs', 'Operations/03 Maintenance', 'Operations/04 Permits', 'Operations/05 Reports', 'Operations/06 Certificates',
];


const TYPES = TYPE_ROWS.map(([code, label, cls, folder]) => ({ code, label, cls, folder }));

module.exports = { FOLDERS, TYPES, TYPE_ROWS, TEMPLATE: { folders: FOLDERS, types: TYPES } };
