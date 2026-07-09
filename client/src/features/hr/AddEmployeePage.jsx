import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Stack, TextInput, PasswordInput, NumberInput, Select, Button, Title, Group, Paper,
  SimpleGrid, ActionIcon, Text, Stepper, Divider, Badge,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { ArrowLeft, User, AtSign, Lock, Briefcase, Building2, Users, Calendar, Target, Wallet, Mail, Phone } from 'lucide-react';
import { createEmployee, fetchEmployees } from '../../api/hr';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS } from '../../constants/nav';

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));
const defUsername = (name) => name.toLowerCase().replace(/[^a-z]/g, '');

// Multi-step wizard, not one long form — each step is a small, self-contained decision
// ("who is this person" / "where do they sit" / "how do we reach them") so it doesn't feel like
// a wall of fields. Every step's data stays in the same form instance, so Back never loses work.
export default function AddEmployeePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = user.editModules?.includes('hr') && user.actions?.includes('hr.addEmployee');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [active, setActive] = useState(0);

  const managersQuery = useQuery({ queryKey: ['hr', 'all-employees-for-select'], queryFn: () => fetchEmployees({ limit: 200 }) });
  const managerOptions = (managersQuery.data?.data || []).map((m) => ({ value: m._id, label: `${m.name} (${ROLE_LABELS[m.role] || m.role})` }));

  const form = useForm({
    initialValues: {
      name: '', arabicName: '', username: '', password: '', role: 'agent', email: '', phone: '',
      desig: '', dept: '', reportsTo: null, target: 0, salary: 0, join: new Date().toISOString().slice(0, 10),
    },
    validate: {
      name: (v) => (v.trim().length ? null : 'Required'),
      username: (v) => (v.trim().length >= 3 ? null : 'At least 3 characters'),
      password: (v) => (v.length >= 6 ? null : 'At least 6 characters'),
      role: (v) => (v ? null : 'Required'),
    },
  });

  useEffect(() => {
    if (usernameTouched) return;
    form.setFieldValue('username', defUsername(form.values.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.name, usernameTouched]);

  const handleSubmit = async (values) => {
    try {
      const res = await createEmployee(values);
      notifications.show({ color: 'dark', message: `${values.name} added — employee ID ${res.data.employeeId}` });
      queryClient.invalidateQueries({ queryKey: ['hr'] });
      navigate(`/hr/${res.data._id}`);
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not add employee', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const goNext = () => {
    if (active === 0) {
      const { hasErrors } = form.validate();
      if (hasErrors) return;
    }
    setActive((s) => Math.min(s + 1, 3));
  };
  const goBack = () => setActive((s) => Math.max(s - 1, 0));

  if (!canEdit) {
    return (
      <Stack gap="md" maw={700}>
        <Group>
          <ActionIcon variant="subtle" onClick={() => navigate('/hr')}>
            <ArrowLeft size={18} />
          </ActionIcon>
          <Title order={3}>Add Employee</Title>
        </Group>
        <Text c="dimmed">You don't have permission to add employees.</Text>
      </Stack>
    );
  }

  const managerLabel = managerOptions.find((m) => m.value === form.values.reportsTo)?.label;

  return (
    <Stack gap="md" maw={820} mx="auto">
      <Group>
        <ActionIcon variant="subtle" onClick={() => navigate('/hr')}>
          <ArrowLeft size={18} />
        </ActionIcon>
        <Title order={3}>Add Employee</Title>
      </Group>

      <Paper withBorder p="xl" radius="md">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stepper active={active} onStepClick={(i) => i < active && setActive(i)} size="sm">
            <Stepper.Step label="Login & Role" description="Who is this person">
              <Stack gap="md" mt="lg">
                <SimpleGrid cols={2}>
                  <TextInput label="Full Name" required leftSection={<User size={16} />} {...form.getInputProps('name')} />
                  <TextInput label="Arabic Name" leftSection={<User size={16} />} {...form.getInputProps('arabicName')} />
                  <Select label="Role" data={ROLE_OPTIONS} required leftSection={<Briefcase size={16} />} {...form.getInputProps('role')} />
                  <TextInput
                    label="Username"
                    required
                    leftSection={<AtSign size={16} />}
                    {...form.getInputProps('username')}
                    onChange={(e) => { setUsernameTouched(true); form.setFieldValue('username', e.currentTarget.value); }}
                  />
                  <PasswordInput label="Temporary Password" required leftSection={<Lock size={16} />} {...form.getInputProps('password')} />
                </SimpleGrid>
              </Stack>
            </Stepper.Step>

            <Stepper.Step label="Employment" description="Where they sit">
              <Stack gap="md" mt="lg">
                <SimpleGrid cols={2}>
                  <TextInput label="Designation" leftSection={<Briefcase size={16} />} {...form.getInputProps('desig')} />
                  <TextInput label="Department" leftSection={<Building2 size={16} />} {...form.getInputProps('dept')} />
                  <Select
                    label="Reports To"
                    placeholder="None (top of chain)"
                    data={managerOptions}
                    searchable
                    clearable
                    leftSection={<Users size={16} />}
                    {...form.getInputProps('reportsTo')}
                  />
                  <TextInput type="date" label="Join Date" leftSection={<Calendar size={16} />} {...form.getInputProps('join')} />
                  <NumberInput label="Monthly Target (AED)" min={0} leftSection={<Target size={16} />} {...form.getInputProps('target')} />
                  <NumberInput label="Salary (AED)" min={0} leftSection={<Wallet size={16} />} {...form.getInputProps('salary')} />
                </SimpleGrid>
              </Stack>
            </Stepper.Step>

            <Stepper.Step label="Contact" description="How to reach them">
              <Stack gap="md" mt="lg">
                <SimpleGrid cols={2}>
                  <TextInput label="Email" leftSection={<Mail size={16} />} {...form.getInputProps('email')} />
                  <TextInput label="Phone" leftSection={<Phone size={16} />} {...form.getInputProps('phone')} />
                </SimpleGrid>
              </Stack>
            </Stepper.Step>

            <Stepper.Completed>
              <Stack gap="md" mt="lg">
                <Text size="sm" c="dimmed">Review before adding — you can go back to any step to change something.</Text>
                <Divider label="Login & Role" labelPosition="left" />
                <SimpleGrid cols={2}>
                  <Text size="sm"><b>Name:</b> {form.values.name || '—'}</Text>
                  <Text size="sm"><b>Arabic Name:</b> {form.values.arabicName || '—'}</Text>
                  <Text size="sm"><b>Role:</b> <Badge variant="light">{ROLE_LABELS[form.values.role] || form.values.role}</Badge></Text>
                  <Text size="sm"><b>Username:</b> {form.values.username || '—'}</Text>
                </SimpleGrid>
                <Divider label="Employment" labelPosition="left" />
                <SimpleGrid cols={2}>
                  <Text size="sm"><b>Designation:</b> {form.values.desig || '—'}</Text>
                  <Text size="sm"><b>Department:</b> {form.values.dept || '—'}</Text>
                  <Text size="sm"><b>Reports To:</b> {managerLabel || 'None (top of chain)'}</Text>
                  <Text size="sm"><b>Join Date:</b> {form.values.join || '—'}</Text>
                  <Text size="sm"><b>Monthly Target:</b> AED {Number(form.values.target || 0).toLocaleString()}</Text>
                  <Text size="sm"><b>Salary:</b> AED {Number(form.values.salary || 0).toLocaleString()}</Text>
                </SimpleGrid>
                <Divider label="Contact" labelPosition="left" />
                <SimpleGrid cols={2}>
                  <Text size="sm"><b>Email:</b> {form.values.email || '—'}</Text>
                  <Text size="sm"><b>Phone:</b> {form.values.phone || '—'}</Text>
                </SimpleGrid>
              </Stack>
            </Stepper.Completed>
          </Stepper>

          <Group justify="space-between" mt="xl">
            <Button variant="default" onClick={goBack} disabled={active === 0}>Back</Button>
            {active < 3 ? (
              <Button onClick={goNext}>Next</Button>
            ) : (
              <Button type="submit">Add Employee</Button>
            )}
          </Group>
        </form>
      </Paper>
    </Stack>
  );
}
