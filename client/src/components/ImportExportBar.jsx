import { useState } from 'react';
import { Group, Button, Modal, Stack, FileInput, Text, ScrollArea, Alert, List } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Download, Upload, TriangleAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Shared Export/Import controls for any module that supports bulk spreadsheet access (DSR,
// Pipeline, Back Office). Gated on user.importExportModules — a separate axis from view/edit,
// set by admin per-role/per-user in Admin > Permissions (see server/services/permissions.js).
export default function ImportExportBar({ moduleKey, filenamePrefix, exportFn, importFn, exportParams, onImported }) {
  const { user } = useAuth();
  const [importOpen, setImportOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  if (!user.importExportModules?.includes(moduleKey)) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportFn(exportParams);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenamePrefix}-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      notifications.show({ color: 'red', title: 'Export failed', message: err.response?.data?.error || 'Something went wrong' });
    } finally {
      setExporting(false);
    }
  };

  const openImport = () => {
    setFile(null);
    setResult(null);
    setImportOpen(true);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const { data } = await importFn(file);
      setResult(data);
      const successCount = data.created ?? data.updated ?? 0;
      if (data.failed === 0) {
        notifications.show({ color: 'dark', message: `Import complete — ${successCount} row(s) processed` });
        setImportOpen(false);
        onImported?.();
      } else if (successCount > 0) {
        notifications.show({ color: 'dark', message: `Imported ${successCount} row(s), ${data.failed} failed — see details` });
        onImported?.();
      }
    } catch (err) {
      notifications.show({ color: 'red', title: 'Import failed', message: err.response?.data?.error || 'Something went wrong' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Group gap="xs">
        <Button variant="light" size="sm" leftSection={<Upload size={16} />} loading={exporting} onClick={handleExport}>
          Export
        </Button>
        <Button variant="light" size="sm" leftSection={<Download size={16} />} onClick={openImport}>
          Import
        </Button>
      </Group>

      <Modal opened={importOpen} onClose={() => setImportOpen(false)} title={`Import ${filenamePrefix}`} size="md">
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Upload an .xlsx, .xls, or .csv file. For best results, start from an exported file and edit it — the column
            headers must match.
          </Text>
          <FileInput placeholder="Choose file" accept=".xlsx,.xls,.csv" value={file} onChange={setFile} clearable />
          <Button onClick={handleImport} loading={importing} disabled={!file}>
            Upload
          </Button>

          {result && (
            <Stack gap="xs">
              <Text size="sm">
                {result.total} row(s) read · {result.created ?? result.updated ?? 0} succeeded · {result.failed} failed
              </Text>
              {result.failed > 0 && (
                <Alert color="red" icon={<TriangleAlert size={16} />} title="Some rows could not be imported">
                  <ScrollArea.Autosize mah={220}>
                    <List size="sm" spacing={4}>
                      {result.errors.map((e, i) => (
                        <List.Item key={i}>Row {e.row}: {e.message}</List.Item>
                      ))}
                    </List>
                  </ScrollArea.Autosize>
                </Alert>
              )}
            </Stack>
          )}
        </Stack>
      </Modal>
    </>
  );
}
