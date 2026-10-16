import { useState } from 'react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import FormField from './FormField.jsx';
import { updateProfile } from '../services/users.js';
import { fieldErrorsFromApi } from '../utils/validation.js';
import { charCount } from '../utils/text.js';

const BIO_MAX = 160;
const NAME_MAX = 50;

// Edits name / bio / avatar URL. Sends only the fields that changed. Username and email can't be changed here.
export default function EditProfileModal({ open, user, onClose, onSaved }) {
  const [values, setValues] = useState({ name: user.name, bio: user.bio || '', avatar: user.avatar || '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => { setValues((v) => ({ ...v, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };
  const close = () => { if (!saving) onClose(); };

  const validate = () => {
    const e = {};
    if (!values.name.trim()) e.name = 'Name is required';
    else if (charCount(values.name.trim()) > NAME_MAX) e.name = `Name must be at most ${NAME_MAX} characters`;
    if (charCount(values.bio.trim()) > BIO_MAX) e.bio = `Bio must be at most ${BIO_MAX} characters`;
    if (values.avatar.trim() && !/^https?:\/\/\S+$/i.test(values.avatar.trim())) e.avatar = 'Avatar must be an http(s) image URL';
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setFormError('');
    const clientErrors = validate();
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    const next = { name: values.name.trim(), bio: values.bio.trim(), avatar: values.avatar.trim() };
    const patch = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== (user[k] || '')));
    if (!Object.keys(patch).length) { onClose(); return; }

    setSaving(true);
    try {
      onSaved(await updateProfile(patch));
    } catch (err) {
      const fe = fieldErrorsFromApi(err);
      if (Object.keys(fe).length) setErrors(fe); else setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const bioLeft = BIO_MAX - charCount(values.bio);

  return (
    <Modal
      open={open}
      wide
      title="Edit profile"
      onClose={close}
      actions={(
        <>
          <Button variant="outline" size="sm" onClick={close} disabled={saving}>Cancel</Button>
          <Button type="submit" form="edit-profile-form" size="sm" loading={saving}>Save</Button>
        </>
      )}
    >
      <form id="edit-profile-form" className="form" onSubmit={submit} noValidate>
        {formError && <div className="form__alert" role="alert">{formError}</div>}
        <FormField label="Name" name="name" value={values.name} onChange={set('name')} error={errors.name} autoComplete="name" />
        <FormField label="Bio" name="bio" multiline value={values.bio} onChange={set('bio')} error={errors.bio}
          hint={`${bioLeft} characters left`} />
        <FormField label="Avatar image URL" name="avatar" value={values.avatar} onChange={set('avatar')} error={errors.avatar}
          hint="Optional. Link to an image (https://...). Leave empty to use your initials." />
      </form>
    </Modal>
  );
}
