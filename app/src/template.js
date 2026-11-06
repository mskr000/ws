'use strict';
/* Standard folder template and document types. A new project starts from this, then is edited. */
const TYPE_ROWS = [
  ['PID', 'P&ID', 'controlled', 'EPC/02 Engineering/02.1 Process'],
  ['PFD', 'Process flow diagram', 'controlled', 'EPC/02 Engineering/02.1 Process'],
  ['ISO', 'Piping isometric', 'controlled', 'EPC/02 Engineering/02.2 Piping'],
  ['SLD', 'Single line diagram', 'controlled', 'EPC/02 Engineering/02.3 Electrical'],
  ['CNT', 'Control narrative', 'controlled', 'EPC/02 Engineering/02.4 Instrumentation & Control'],
  ['FND', 'Foundation layout', 'controlled', 'EPC/02 Engineering/02.5 Civil & Structural'],
  ['PLN', 'Project execution plan', 'controlled', 'EPC/01 Project Management'],
  ['PO', 'Purchase order', 'controlled', 'EPC/03 Procurement/03.2 Purchase Orders'],
  ['VDR', 'Vendor document', 'controlled', 'EPC/03 Procurement/03.3 Vendor Documents'],
  ['MS', 'Method statement', 'controlled', 'EPC/04 Construction/04.1 Method Statements'],
  ['ITP', 'Inspection and test plan', 'controlled', 'EPC/04 Construction/04.2 Inspection & Test Plans'],
  ['ABD', 'As-built drawing', 'controlled', 'EPC/06 Handover/06.1 As-Built'],
  ['OM', 'O&M manual', 'controlled', 'EPC/06 Handover/06.2 O&M Manuals'],
  ['MAN', 'Operations manual', 'controlled', 'Operations/01 Manuals'],
  ['SOP', 'Standard operating procedure', 'controlled', 'Operations/02 SOPs'],
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

const OPS_FOLDERS = FOLDERS.filter(f => f.startsWith('Operations/'));
const EPC_FOLDERS = FOLDERS.filter(f => f.startsWith('EPC/'));
const folderOf = code => TYPES.find(t => t.code === code).folder;
const typesFor = (codes) => codes.map(code => ({ code, enabled: true, folder: folderOf(code), firstNumber: 1 }));

/* Built-in project templates. Choosing one fills the project form. The user can still change everything. */
const BUILT_IN_TEMPLATES = [
  {
    id: 'epc-standard', name: 'EPC project (standard)',
    description: 'Full EPC structure: project management, engineering, procurement, construction, commissioning and handover. Every document type on.',
    numberPattern: '{PROJ}-{TYPE}-{SEQ:4}', folders: EPC_FOLDERS,
    types: typesFor(TYPES.filter(t => t.folder.startsWith('EPC/')).map(t => t.code)),
  },
  {
    id: 'operations-only', name: 'Operations (plant running)',
    description: 'For a plant in operation: manuals, SOPs, monthly checks, permits, monthly reports and certificates.',
    numberPattern: '{PROJ}-{TYPE}-{SEQ:4}', folders: OPS_FOLDERS,
    types: typesFor(['MAN', 'SOP', 'MNT', 'RPT', 'PTW', 'CERT']),
  },
  {
    id: 'engineering-drawings', name: 'Engineering drawings only',
    description: 'Small engineering job: P&IDs, isometrics, single line diagrams, method statements and the execution plan.',
    numberPattern: '{PROJ}-{TYPE}-{SEQ:4}',
    folders: ['EPC/01 Project Management', 'EPC/02 Engineering/02.1 Process', 'EPC/02 Engineering/02.2 Piping', 'EPC/02 Engineering/02.3 Electrical', 'EPC/04 Construction/04.1 Method Statements'],
    types: typesFor(['PLN', 'PID', 'ISO', 'SLD', 'MS']),
  },
];

module.exports = { FOLDERS, TYPES, TYPE_ROWS, TEMPLATE: { folders: FOLDERS, types: TYPES }, BUILT_IN_TEMPLATES };
