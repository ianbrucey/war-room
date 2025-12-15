ianbruce@MacBook-Pro-9160 aionui % npm run webui
npm warn Unknown project config "ELECTRON_MIRROR". This will stop working in the next major version of npm.

> AionUi@1.5.2 webui
> npm run cli -- --webui

npm warn Unknown env config "electron-mirror". This will stop working in the next major version of npm.
npm warn Unknown project config "ELECTRON_MIRROR". This will stop working in the next major version of npm.

> AionUi@1.5.2 cli
> cross-env electron-forge start -- --webui

✔ Checking your system
✔ Locating application
✔ Loading configuration
✔ Preparing native dependencies: 3 / 3 [2s]
✔ Running generateAssets hook
✔ Running preStart hook
  ✔ [plugin-webpack] Preparing webpack bundles
    ✔ Compiling main process code [46s]
    ✔ Launching dev servers for renderer process code [1m7s]
      › Output Available: http://localhost:9000
✔ Launched Electron app. Type rs in terminal to restart main process.

`<e>` [ForkTsCheckerWebpackPlugin] ERROR in ./src/process/documents/services/CaseSummaryGenerator.ts:47:44
`<e>` TS2551: Property 'findByCaseId' does not exist on type '{ create(doc: Omit<ICaseDocument, "id">): ICaseDocument; findById(id: string): ICaseDocument; findByCaseFileId(caseFileId: string): ICaseDocument[]; ... 5 more ...; getStats(caseFileId: string): { ...; }; }'. Did you mean 'findById'?
`<e>`     45 |
`<e>`     46 |       // Get all completed documents
`<e>`   > 47 |       const documents = DocumentRepository.findByCaseId(caseId);
`<e>`        |                                            ^^^^^^^^^^^^
`<e>`     48 |       const completedDocs = documents.filter(doc => doc.processing_status === 'complete');
`<e>`     49 |
`<e>`     50 |       if (completedDocs.length === 0) {
`<e>`
`<e>` ERROR in ./src/process/documents/services/CaseSummaryGenerator.ts:48:46
`<e>` TS7006: Parameter 'doc' implicitly has an 'any' type.
`<e>`     46 |       // Get all completed documents
`<e>`     47 |       const documents = DocumentRepository.findByCaseId(caseId);
`<e>`   > 48 |       const completedDocs = documents.filter(doc => doc.processing_status === 'complete');
`<e>`        |                                              ^^^
`<e>`     49 |
`<e>`     50 |       if (completedDocs.length === 0) {
`<e>`     51 |         throw new Error('No processed documents found for this case');
`<e>`
`<e>` ERROR in ./src/process/documents/services/CaseSummaryGenerator.ts:66:27
`<e>` TS7006: Parameter 'd' implicitly has an 'any' type.
`<e>`     64 |       const summary = await this.processInBatches(
`<e>`     65 |         metadataFiles,
`<e>`   > 66 |         completedDocs.map(d => d.id),
`<e>`        |                           ^
`<e>`     67 |         onProgress
`<e>`     68 |       );
`<e>`     69 |
`<e>`
`<e>` ERROR in ./src/process/documents/services/CaseSummaryGenerator.ts:135:44
`<e>` TS2551: Property 'findByCaseId' does not exist on type '{ create(doc: Omit<ICaseDocument, "id">): ICaseDocument; findById(id: string): ICaseDocument; findByCaseFileId(caseFileId: string): ICaseDocument[]; ... 5 more ...; getStats(caseFileId: string): { ...; }; }'. Did you mean 'findById'?
`<e>`     133 |
`<e>`     134 |       // Get all completed documents
`<e>`   > 135 |       const documents = DocumentRepository.findByCaseId(caseId);
`<e>`         |                                            ^^^^^^^^^^^^
`<e>`     136 |       const completedDocs = documents.filter(doc => doc.processing_status === 'complete');
`<e>`     137 |
`<e>`     138 |       // Filter to only new documents (uploaded after last summary generation)
`<e>`
`<e>` ERROR in ./src/process/documents/services/CaseSummaryGenerator.ts:136:46
`<e>` TS7006: Parameter 'doc' implicitly has an 'any' type.
`<e>`     134 |       // Get all completed documents
`<e>`     135 |       const documents = DocumentRepository.findByCaseId(caseId);
`<e>`   > 136 |       const completedDocs = documents.filter(doc => doc.processing_status === 'complete');
`<e>`         |                                              ^^^
`<e>`     137 |
`<e>`     138 |       // Filter to only new documents (uploaded after last summary generation)
`<e>`     139 |       const lastGenerated = caseFile.case_summary_generated_at ?? 0;
`<e>`
`<e>` ERROR in ./src/process/documents/services/CaseSummaryGenerator.ts:140:44
`<e>` TS7006: Parameter 'doc' implicitly has an 'any' type.
`<e>`     138 |       // Filter to only new documents (uploaded after last summary generation)
`<e>`     139 |       const lastGenerated = caseFile.case_summary_generated_at ?? 0;
`<e>`   > 140 |       const newDocs = completedDocs.filter(doc => doc.uploaded_at > lastGenerated);
`<e>`         |                                            ^^^
`<e>`     141 |
`<e>`     142 |       if (newDocs.length === 0) {
`<e>`     143 |         throw new Error('No new documents to incorporate');
`<e>`
`<e>` ERROR in ./src/process/documents/services/CaseSummaryGenerator.ts:155:21
`<e>` TS7006: Parameter 'd' implicitly has an 'any' type.
`<e>`     153 |         existingSummary,
`<e>`     154 |         newMetadataFiles,
`<e>`   > 155 |         newDocs.map(d => d.id)
`<e>`         |                     ^
`<e>`     156 |       );
`<e>`     157 |
`<e>`     158 |       // Write updated summary
`<e>`
`<e>` ERROR in ./src/renderer/components/UploadCaseFilesModal/index.tsx:486:16
`<e>` TS2304: Cannot find name 'CaseSummaryControls'.
`<e>`     484 |               />
`<e>`     485 |
`<e>`   > 486 |               <CaseSummaryControls
`<e>`         |                ^^^^^^^^^^^^^^^^^^^
`<e>`     487 |                 caseId={caseFileId}
`<e>`     488 |                 summaryStatus={summaryStatus}
`<e>`     489 |                 summaryGeneratedAt={summaryGeneratedAt}
`<e>`
`<e>` ERROR in ./src/webserver/auth/repository/CaseFileRepository.ts:134:10
`<e>` TS2339: Property 'execute' does not exist on type 'AionUIDatabase'.
`<e>`     132 |     const db = getDatabase();
`<e>`     133 |     try {
`<e>`   > 134 |       db.execute(
`<e>`         |          ^^^^^^^
`<e>`     135 |         `UPDATE case_files <e>     136 |          SET case_summary_status = ?, updated_at = ? <e>     137 |          WHERE id = ?`,
`<e>`
`<e>` ERROR in ./src/webserver/auth/repository/CaseFileRepository.ts:156:10
`<e>` TS2339: Property 'execute' does not exist on type 'AionUIDatabase'.
`<e>`     154 |     const db = getDatabase();
`<e>`     155 |     try {
`<e>`   > 156 |       db.execute(
`<e>`         |          ^^^^^^^
`<e>`     157 |         `UPDATE case_files <e>     158 |          SET case_summary_status = 'generated', <e>     159 |              case_summary_generated_at = ?, <e>  <e> ERROR in ./src/webserver/auth/repository/CaseFileRepository.ts:184:10 <e> TS2339: Property 'execute' does not exist on type 'AionUIDatabase'. <e>     182 |     try { <e>     183 |       // Only update if current status is 'generated' <e>   > 184 |       db.execute( <e>         |          ^^^^^^^ <e>     185 |         `UPDATE case_files
`<e>`     186 |          SET case_summary_status = 'stale', updated_at = ?
`<e>`     187 |          WHERE id = ? AND case_summary_status = 'generated'`, <e>  <e> ERROR in ./src/webserver/auth/repository/CaseFileRepository.ts:205:10 <e> TS2339: Property 'execute' does not exist on type 'AionUIDatabase'. <e>     203 |     const db = getDatabase(); <e>     204 |     try { <e>   > 205 |       db.execute( <e>         |          ^^^^^^^ <e>     206 |         `UPDATE case_files
`<e>`     207 |          SET case_summary_status = 'failed', updated_at = ?
`<e>`     208 |          WHERE id = ?`,
`<e>`
`<i>` [ForkTsCheckerWebpackPlugin] Found 12 errors in 45628 ms.

[dotenv@17.2.3] injecting env (114) from .env -- tip: ✅ audit secrets and track compliance: https://dotenvx.com/ops
build.buildStorage global
