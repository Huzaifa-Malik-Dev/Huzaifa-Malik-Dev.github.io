import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Stack, TextInput, NumberInput, Select, Button, Divider, Title, Text, Group, FileButton, Badge,
  SimpleGrid, Paper, Loader, Center, ActionIcon, Tooltip, Avatar,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { ArrowLeft, Upload, Pencil, Eye, Camera } from 'lucide-react';
import { fetchEmployee, updateEmployee, uploadEmployeeDoc } from '../../api/hr';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS } from '../../constants/nav';
import { docHealth } from './docHealth';
import { colorFor, initials } from '../../utils/avatar';

const emptyCompliance = {
  dob: '', nationality: '', passportNo: '', passportExpiry: '', visaCompany: '', visaExpiry: '',
  eid: '', eidIssue: '', eidExpiry: '', labourCardNo: '', labourCardIssue: '', labourCardExpiry: '',
  insuranceIssue: '', insuranceExpiry: '',
  legalCaseStatus: 'None', legalCaseNote: '',
  abscondingMohre: 'None', abscondingMohreNote: '',
  abscondingGdrfa: 'None', abscondingGdrfaNote: '',
};

const STATUS_OPTIONS = ['Active', 'Inactive', 'Frozen', 'Absconding'];
const STATUS_COLOR = { Active: 'green', Inactive: 'gray', Frozen: 'blue', Absconding: 'red' };
const LEGAL_CASE_STATUS = ['None', 'Pending', 'Resolved'];
const ABSCONDING_STATUS = ['None', 'Reported', 'Cleared'];

// One doc slot (No./Expiry + Front/Back image upload). imgFieldB is optional — Labour Card only
// has one side, everything else (Passport/Visa/EID/Insurance) has both.
function DocField({ label, dateProps, noProps, imgFieldF, imgFieldB, employeeId, imgPathF, imgPathB, canEdit, onUploaded }) {
  const health = dateProps ? docHealth(dateProps.value) : null;

  const uploadSide = async (field, sideLabel, file) => {
    if (!file) return;
    try {
      await uploadEmployeeDoc(employeeId, field, file);
      notifications.show({ color: 'dark', message: `${label} (${sideLabel}) uploaded` });
      onUploaded();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Upload failed', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const side = (sideLabel, field, path) => (
    <Stack gap={4}>
      <Text size="xs" c="dimmed">{sideLabel}</Text>
      <Group gap={6} wrap="nowrap">
        {canEdit && (
          <FileButton accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(file) => uploadSide(field, sideLabel, file)}>
            {(props) => <Button {...props} size="compact-xs" variant="light" leftSection={<Upload size={12} />}>Upload</Button>}
          </FileButton>
        )}
        {path && <Text component="a" href={`${import.meta.env.VITE_API_URL}${path}`} target="_blank" size="xs" c="blue">View</Text>}
      </Group>
    </Stack>
  );

  return (
    <Stack gap={4}>
      <Group justify="space-between" align="flex-end">
        <Text size="sm" fw={600}>{label}</Text>
        {health && <Badge size="xs" color={health.color} variant="light">{health.label}</Badge>}
      </Group>
      <Group grow>
        {noProps && <TextInput label="No." size="xs" readOnly={!canEdit} {...noProps} />}
        {dateProps && <TextInput type="date" label="Expiry" size="xs" readOnly={!canEdit} {...dateProps} />}
      </Group>
      <Group gap="lg">
        {imgFieldF && side('Front', imgFieldF, imgPathF)}
        {imgFieldB && side('Back', imgFieldB, imgPathB)}
      </Group>
    </Stack>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = user.editModules?.includes('hr');
  const editMode = searchParams.get('edit') === '1';
  const isSelf = String(id) === String(user.id);
  // Viewing is always available; actually editing requires both hr edit access AND explicit edit mode.
  const editing = canEdit && editMode;

  const { data, isLoading } = useQuery({ queryKey: ['hr', 'employee', id], queryFn: () => fetchEmployee(id) });
  const employee = data?.data;

  const form = useForm({
    initialValues: {
      name: '', arabicName: '', desig: '', dept: '', email: '', phone: '',
      target: 0, salary: 0, join: '', status: 'Active',
      compliance: emptyCompliance,
    },
  });

  useEffect(() => {
    if (!employee) return;
    form.setValues({
      name: employee.name || '',
      arabicName: employee.arabicName || '',
      desig: employee.desig || '',
      dept: employee.dept || '',
      email: employee.email || '',
      phone: employee.phone || '',
      target: employee.target || 0,
      salary: employee.salary || 0,
      join: employee.join || '',
      status: employee.status || (employee.active !== false ? 'Active' : 'Inactive'),
      compliance: { ...emptyCompliance, ...(employee.compliance || {}) },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?._id]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['hr'] });

  const handleSubmit = async (values) => {
    try {
      await updateEmployee(id, values);
      notifications.show({ color: 'dark', message: 'Employee updated' });
      refresh();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not save', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  if (isLoading) return <Center py="xl"><Loader size="sm" /></Center>;
  if (!employee) return <Text c="dimmed">Employee not found</Text>;

  const docs = employee.docs || {};
  const currentStatus = employee.status || (employee.active !== false ? 'Active' : 'Inactive');

  const handleUploadProfilePic = async (file) => {
    if (!file) return;
    try {
      await uploadEmployeeDoc(employee._id, 'profilePic', file);
      notifications.show({ color: 'dark', message: 'Profile picture updated' });
      refresh();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Upload failed', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  return (
    <Stack gap="md" w="100%">
      <Group justify="space-between">
        <Group>
          <ActionIcon variant="subtle" onClick={() => navigate('/hr')}>
            <ArrowLeft size={18} />
          </ActionIcon>
          <div>
            <Title order={3}>{employee.name}</Title>
            <Group gap="xs">
              <Text size="sm" c="dimmed">{employee.employeeId}</Text>
              <Badge size="xs" variant="light">{ROLE_LABELS[employee.role] || employee.role}</Badge>
              <Badge size="xs" color={STATUS_COLOR[currentStatus] || 'gray'} variant="light">{currentStatus}</Badge>
            </Group>
          </div>
        </Group>
        {canEdit && (
          editing ? (
            <Button size="xs" variant="light" leftSection={<Eye size={14} />} onClick={() => setSearchParams({})}>
              Back to view
            </Button>
          ) : (
            <Button size="xs" variant="light" color="red" leftSection={<Pencil size={14} />} onClick={() => setSearchParams({ edit: '1' })}>
              Edit
            </Button>
          )
        )}
      </Group>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Group align="flex-start" gap="md" wrap="wrap">
        <Stack gap="md" style={{ flex: '3 1 480px', minWidth: 320 }}>
          <Paper withBorder p="md" radius="md">
            <Divider label="Employment" labelPosition="left" mb="sm" />
            <SimpleGrid cols={2}>
              <TextInput label="Full Name" readOnly={!editing} {...form.getInputProps('name')} />
              <TextInput label="Arabic Name" readOnly={!editing} {...form.getInputProps('arabicName')} />
              <TextInput label="Designation" readOnly={!editing} {...form.getInputProps('desig')} />
              <TextInput label="Department" readOnly={!editing} {...form.getInputProps('dept')} />
              <TextInput type="date" label="Join Date" readOnly={!editing} {...form.getInputProps('join')} />
              <NumberInput label="Monthly Target (AED)" readOnly={!editing} {...form.getInputProps('target')} />
              <NumberInput label="Salary (AED)" readOnly={!editing} {...form.getInputProps('salary')} />
            </SimpleGrid>
            <Tooltip label="You can't change your own status - ask another admin or HR" disabled={!isSelf}>
              <Select
                mt="sm"
                label="Status"
                data={STATUS_OPTIONS}
                disabled={editing && isSelf}
                readOnly={!editing}
                maw={220}
                {...form.getInputProps('status')}
              />
            </Tooltip>
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Divider label="Personal" labelPosition="left" mb="sm" />
            <SimpleGrid cols={2}>
              <TextInput label="Email" readOnly={!editing} {...form.getInputProps('email')} />
              <TextInput label="Phone" readOnly={!editing} {...form.getInputProps('phone')} />
              <TextInput type="date" label="Date of Birth" readOnly={!editing} {...form.getInputProps('compliance.dob')} />
              <TextInput label="Nationality" readOnly={!editing} {...form.getInputProps('compliance.nationality')} />
            </SimpleGrid>
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Stack gap="md">
              <Divider label="Passport" labelPosition="left" />
              <DocField
                label="Passport"
                noProps={form.getInputProps('compliance.passportNo')}
                dateProps={form.getInputProps('compliance.passportExpiry')}
                imgFieldF="passportImgF"
                imgFieldB="passportImgB"
                employeeId={employee._id}
                imgPathF={docs.passportImgF}
                imgPathB={docs.passportImgB}
                canEdit={editing}
                onUploaded={refresh}
              />

              <Divider label="Visa" labelPosition="left" />
              <TextInput label="Sponsor Company" size="xs" readOnly={!editing} {...form.getInputProps('compliance.visaCompany')} />
              <DocField
                label="Visa"
                dateProps={form.getInputProps('compliance.visaExpiry')}
                imgFieldF="visaImgF"
                imgFieldB="visaImgB"
                employeeId={employee._id}
                imgPathF={docs.visaImgF}
                imgPathB={docs.visaImgB}
                canEdit={editing}
                onUploaded={refresh}
              />

              <Divider label="Emirates ID" labelPosition="left" />
              <DocField
                label="Emirates ID"
                noProps={form.getInputProps('compliance.eid')}
                dateProps={form.getInputProps('compliance.eidExpiry')}
                imgFieldF="eidImgF"
                imgFieldB="eidImgB"
                employeeId={employee._id}
                imgPathF={docs.eidImgF}
                imgPathB={docs.eidImgB}
                canEdit={editing}
                onUploaded={refresh}
              />

              <Divider label="Labour Card (MOHRE)" labelPosition="left" />
              <DocField
                label="Labour Card"
                noProps={form.getInputProps('compliance.labourCardNo')}
                dateProps={form.getInputProps('compliance.labourCardExpiry')}
                imgFieldF="labourCardImg"
                employeeId={employee._id}
                imgPathF={docs.labourCardImg}
                canEdit={editing}
                onUploaded={refresh}
              />

              <Divider label="Insurance" labelPosition="left" />
              <DocField
                label="Insurance"
                dateProps={form.getInputProps('compliance.insuranceExpiry')}
                imgFieldF="insuranceImgF"
                imgFieldB="insuranceImgB"
                employeeId={employee._id}
                imgPathF={docs.insuranceImgF}
                imgPathB={docs.insuranceImgB}
                canEdit={editing}
                onUploaded={refresh}
              />

              <Divider label="Legal Case" labelPosition="left" />
              <SimpleGrid cols={2}>
                <Select label="Status" data={LEGAL_CASE_STATUS} readOnly={!editing} {...form.getInputProps('compliance.legalCaseStatus')} />
                <TextInput label="Note" readOnly={!editing} {...form.getInputProps('compliance.legalCaseNote')} />
              </SimpleGrid>

              <Divider label="Absconding" labelPosition="left" />
              <SimpleGrid cols={2}>
                <Select label="MOHRE Status" data={ABSCONDING_STATUS} readOnly={!editing} {...form.getInputProps('compliance.abscondingMohre')} />
                <TextInput label="MOHRE Note" readOnly={!editing} {...form.getInputProps('compliance.abscondingMohreNote')} />
                <Select label="GDRFA Status" data={ABSCONDING_STATUS} readOnly={!editing} {...form.getInputProps('compliance.abscondingGdrfa')} />
                <TextInput label="GDRFA Note" readOnly={!editing} {...form.getInputProps('compliance.abscondingGdrfaNote')} />
              </SimpleGrid>
            </Stack>
          </Paper>

          {editing && <Button type="submit">Save Changes</Button>}
        </Stack>

        <Stack gap="md" style={{ flex: '1 1 260px', minWidth: 240, maxWidth: 280 }}>
          <Paper withBorder p="md" radius="md">
            <Stack align="center" gap="sm">
              <Avatar
                size={140}
                radius="md"
                color={colorFor(employee.name)}
                src={docs.profilePic ? `${import.meta.env.VITE_API_URL}${docs.profilePic}` : null}
              >
                {!docs.profilePic && initials(employee.name)}
              </Avatar>
              {editing && (
                <FileButton accept="image/png,image/jpeg,image/webp" onChange={handleUploadProfilePic}>
                  {(props) => (
                    <Button {...props} size="xs" variant="light" fullWidth leftSection={<Camera size={14} />}>
                      Change Photo
                    </Button>
                  )}
                </FileButton>
              )}
            </Stack>
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
              <div>
                <Text size="xs" c="dimmed">Employee ID</Text>
                <Text size="sm" fw={600}>{employee.employeeId}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Role</Text>
                <Text size="sm">{ROLE_LABELS[employee.role] || employee.role}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Status</Text>
                <Badge size="sm" color={STATUS_COLOR[currentStatus] || 'gray'} variant="light">{currentStatus}</Badge>
              </div>
              <div>
                <Text size="xs" c="dimmed">Department</Text>
                <Text size="sm">{employee.dept || '—'}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Join Date</Text>
                <Text size="sm">{employee.join || '—'}</Text>
              </div>
            </Stack>
          </Paper>
        </Stack>
        </Group>
      </form>
    </Stack>
  );
}
