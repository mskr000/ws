<#
.SYNOPSIS
  Creates the lists, library and permission groups for the Document Register on a SharePoint Online site.

.DESCRIPTION
  Run once per site (test first, then production). Safe to run again: existing lists and columns are skipped.
  Column internal names match app-spfx/src/services/register.ts. Change one, change both.

  Needs the PnP.PowerShell module (Install-Module PnP.PowerShell -Scope CurrentUser) and an account
  that is a site owner on the target site.

.PARAMETER SiteUrl
  Your site address, for example https://yourcompany.sharepoint.com/sites/DocumentRegister

.EXAMPLE
  .\Provision-DocumentRegister.ps1 -SiteUrl https://yourcompany.sharepoint.com/sites/DocumentRegisterTest
#>
param(
  [Parameter(Mandatory = $true)][string]$SiteUrl
)

$ErrorActionPreference = 'Stop'
Import-Module PnP.PowerShell

Connect-PnPOnline -Url $SiteUrl -Interactive

function Ensure-List([string]$Title) {
  $list = Get-PnPList -Identity $Title -ErrorAction SilentlyContinue
  if (-not $list) {
    $list = New-PnPList -Title $Title -Template GenericList -OnQuickLaunch:$false
    Write-Host "Created list: $Title"
  } else { Write-Host "Exists: $Title" }
  return $list
}

function Ensure-Field([string]$List, [string]$InternalName, [string]$Type, [string]$DisplayName, [switch]$Indexed) {
  $f = Get-PnPField -List $List -Identity $InternalName -ErrorAction SilentlyContinue
  if (-not $f) {
    Add-PnPField -List $List -InternalName $InternalName -DisplayName $DisplayName -Type $Type -AddToDefaultView | Out-Null
    Write-Host "  + $List.$InternalName ($Type)"
  }
  if ($Indexed) { Set-PnPField -List $List -Identity $InternalName -Values @{ Indexed = $true } | Out-Null }
}

# ---------- Lists ----------
Ensure-List 'Projects' | Out-Null
Ensure-Field 'Projects' 'ProjectName' 'Text' 'Project name'
Ensure-Field 'Projects' 'ProjectStatus' 'Text' 'Project status'
Ensure-Field 'Projects' 'NumberPattern' 'Text' 'Numbering pattern'

Ensure-List 'ProjectTypes' | Out-Null
Ensure-Field 'ProjectTypes' 'ProjectCode' 'Text' 'Project code' -Indexed
Ensure-Field 'ProjectTypes' 'TypeCode' 'Text' 'Type code' -Indexed
Ensure-Field 'ProjectTypes' 'Folder' 'Text' 'Folder'
Ensure-Field 'ProjectTypes' 'FirstNumber' 'Number' 'First number'

Ensure-List 'ProjectFolders' | Out-Null
Ensure-Field 'ProjectFolders' 'ProjectCode' 'Text' 'Project code' -Indexed

Ensure-List 'Templates' | Out-Null
Ensure-Field 'Templates' 'Description' 'Note' 'Description'
Ensure-Field 'Templates' 'Body' 'Note' 'Template body'

Ensure-List 'Documents' | Out-Null
Ensure-Field 'Documents' 'DocNumber' 'Text' 'Document number' -Indexed
Ensure-Field 'Documents' 'ProjectCode' 'Text' 'Project code' -Indexed
Ensure-Field 'Documents' 'DocType' 'Text' 'Type code'
Ensure-Field 'Documents' 'DocKind' 'Text' 'Kind'
Ensure-Field 'Documents' 'Folder' 'Text' 'Folder'
Ensure-Field 'Documents' 'Owner' 'Text' 'Owner'
Ensure-Field 'Documents' 'IsRemoved' 'Boolean' 'Removed'
Ensure-Field 'Documents' 'SharePointName' 'Text' 'File name in library'
Ensure-Field 'Documents' 'DueDay' 'Number' 'Due day'
Ensure-Field 'Documents' 'StartPeriod' 'Text' 'First month'

Ensure-List 'Revisions' | Out-Null
Ensure-Field 'Revisions' 'DocumentId' 'Number' 'Document ID' -Indexed
Ensure-Field 'Revisions' 'RevNumber' 'Number' 'Revision number'
Ensure-Field 'Revisions' 'Status' 'Text' 'Status'
Ensure-Field 'Revisions' 'Reason' 'Text' 'Reason'
Ensure-Field 'Revisions' 'Summary' 'Note' 'Summary'
Ensure-Field 'Revisions' 'Note' 'Note' 'Note for checker'
Ensure-Field 'Revisions' 'Uploader' 'Text' 'Uploaded by'
Ensure-Field 'Revisions' 'Checker' 'Text' 'Checker'
Ensure-Field 'Revisions' 'Approver' 'Text' 'Approver'
Ensure-Field 'Revisions' 'CheckedBy' 'Text' 'Checked by'
Ensure-Field 'Revisions' 'ApprovedBy' 'Text' 'Approved by'
Ensure-Field 'Revisions' 'ReturnNote' 'Note' 'Sent back reason'
Ensure-Field 'Revisions' 'FileName' 'Text' 'File name'
Ensure-Field 'Revisions' 'FileUrl' 'Text' 'File link'
Ensure-Field 'Revisions' 'Checksum' 'Text' 'SHA-256 checksum'

Ensure-List 'PeriodEntries' | Out-Null
Ensure-Field 'PeriodEntries' 'DocumentId' 'Number' 'Document ID' -Indexed
Ensure-Field 'PeriodEntries' 'PeriodKey' 'Text' 'Period' -Indexed
Ensure-Field 'PeriodEntries' 'Version' 'Number' 'Version'
Ensure-Field 'PeriodEntries' 'NotNeeded' 'Boolean' 'Not needed'
Ensure-Field 'PeriodEntries' 'NotNeededReason' 'Note' 'Not needed reason'
Ensure-Field 'PeriodEntries' 'Summary' 'Note' 'Summary'
Ensure-Field 'PeriodEntries' 'Uploader' 'Text' 'Uploaded by'
Ensure-Field 'PeriodEntries' 'UploadedAt' 'DateTime' 'Uploaded at'
Ensure-Field 'PeriodEntries' 'FileName' 'Text' 'File name'
Ensure-Field 'PeriodEntries' 'FileUrl' 'Text' 'File link'
Ensure-Field 'PeriodEntries' 'Checksum' 'Text' 'SHA-256 checksum'
Ensure-Field 'PeriodEntries' 'ReplaceReason' 'Note' 'Replace reason'

Ensure-List 'CertificateVersions' | Out-Null
Ensure-Field 'CertificateVersions' 'DocumentId' 'Number' 'Document ID' -Indexed
Ensure-Field 'CertificateVersions' 'VersionNo' 'Number' 'Version'
Ensure-Field 'CertificateVersions' 'Summary' 'Note' 'Summary'
Ensure-Field 'CertificateVersions' 'ExpiresOn' 'DateTime' 'Expires on'
Ensure-Field 'CertificateVersions' 'Uploader' 'Text' 'Uploaded by'
Ensure-Field 'CertificateVersions' 'FileName' 'Text' 'File name'
Ensure-Field 'CertificateVersions' 'FileUrl' 'Text' 'File link'
Ensure-Field 'CertificateVersions' 'Checksum' 'Text' 'SHA-256 checksum'
Ensure-Field 'CertificateVersions' 'UploadedAt' 'DateTime' 'Uploaded at'

Ensure-List 'AuditLog' | Out-Null
Ensure-List 'Permissions' | Out-Null
Ensure-Field 'Permissions' 'ProjectCode' 'Text' 'Project code (* = all)'
Ensure-Field 'Permissions' 'FolderPath' 'Text' 'Folder (blank = whole project)'
Ensure-Field 'Permissions' 'Capability' 'Text' 'Permission'
Ensure-Field 'AuditLog' 'WhoName' 'Text' 'Who'
Ensure-Field 'AuditLog' 'At' 'DateTime' 'When'
Ensure-Field 'AuditLog' 'DocNumber' 'Text' 'Document number' -Indexed
Ensure-Field 'AuditLog' 'DocumentId' 'Number' 'Document ID' -Indexed
Ensure-Field 'AuditLog' 'Detail' 'Note' 'Detail'

# ---------- Library ----------
if (-not (Get-PnPList -Identity 'Register Files' -ErrorAction SilentlyContinue)) {
  New-PnPList -Title 'Register Files' -Template DocumentLibrary | Out-Null
  Write-Host 'Created library: Register Files'
}
Set-PnPList -Identity 'Register Files' -EnableVersioning $true | Out-Null

# ---------- Permission groups ----------
foreach ($g in @('Register Members', 'Register Records Lead')) {
  if (-not (Get-PnPGroup -Identity $g -ErrorAction SilentlyContinue)) {
    New-PnPGroup -Title $g | Out-Null
    Write-Host "Created group: $g. Add people to it in site settings."
  }
}

# Add-only role for the audit log: members may add entries, never edit or delete them.
if (-not (Get-PnPRoleDefinition -Identity 'Register Add Only' -ErrorAction SilentlyContinue)) {
  Add-PnPRoleDefinition -RoleName 'Register Add Only' -Description 'Add and view only. Used for the audit log.' `
    -Clone 'Read' -Include AddListItems | Out-Null
  Write-Host "Created permission level: Register Add Only"
}

# Stop the register lists and library inheriting access from the whole site.
# Site owners keep access. Everyone else gets only what is set below.
$secured = @('Projects','ProjectTypes','ProjectFolders','Templates','Documents','Revisions','PeriodEntries','CertificateVersions','AuditLog','Permissions','Register Files')
foreach ($l in $secured) {
  Set-PnPList -Identity $l -BreakRoleInheritance -CopyRoleAssignments:$false -ClearSubscopes | Out-Null
  Set-PnPListPermission -Identity $l -AddRole 'Full Control' -Group 'Register Records Lead' | Out-Null
}

# Reference lists: members can read, only the Records Lead changes them.
foreach ($l in @('Projects','ProjectTypes','ProjectFolders','Templates','Permissions')) {
  Set-PnPListPermission -Identity $l -AddRole 'Read' -Group 'Register Members' | Out-Null
}
# Working lists: members add and update (checks, approvals, uploads).
foreach ($l in @('Documents','Revisions','PeriodEntries','CertificateVersions')) {
  Set-PnPListPermission -Identity $l -AddRole 'Edit' -Group 'Register Members' | Out-Null
}
# Audit log: members may only add entries. Nobody but the Records Lead may change them.
Set-PnPListPermission -Identity 'AuditLog' -AddRole 'Register Add Only' -Group 'Register Members' | Out-Null
# Files: members upload. Nobody deletes (removal renames).
Set-PnPListPermission -Identity 'Register Files' -AddRole 'Edit' -Group 'Register Members' | Out-Null

Write-Host ''
Write-Host 'Done. Next: add people to the two groups, then add the Document Register web part to a page.'
Write-Host 'Note: the Projects and DocumentTypes lists need data. Enter one row per project and per document type.'
