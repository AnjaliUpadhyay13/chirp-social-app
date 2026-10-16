import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FormField from '../components/FormField.jsx';
import Button from '../components/Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { validateRegister, fieldErrorsFromApi } from '../utils/validation.js';

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: '', username: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { document.title = 'Sign up / Chirp'; }, []);

  const set = (k) => (e) => { setValues((v) => ({ ...v, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const onSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const clientErrors = validateRegister(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setLoading(true);
    try {
      const user = await register({ ...values, name: values.name.trim(), username: values.username.trim(), email: values.email.trim() });
      toast.success(`Account created. Welcome, ${user.name.split(' ')[0]}!`);
      navigate('/', { replace: true });
    } catch (err) {
      const fe = fieldErrorsFromApi(err);
      if (Object.keys(fe).length) setErrors(fe);
      else setFormError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="auth-card__title">Create your account</h1>
      <p className="auth-card__sub">It only takes a minute.</p>
      <form onSubmit={onSubmit} noValidate className="form">
        {formError && <div className="form__alert" role="alert">{formError}</div>}
        <FormField label="Name" name="name" autoComplete="name" value={values.name} onChange={set('name')} error={errors.name} autoFocus />
        <FormField label="Username" name="username" autoComplete="username" value={values.username} onChange={set('username')} error={errors.username} hint="3-20 characters: letters, numbers, underscore" />
        <FormField label="Email" name="email" type="email" autoComplete="email" value={values.email} onChange={set('email')} error={errors.email} />
        <FormField label="Password" name="password" type="password" autoComplete="new-password" value={values.password} onChange={set('password')} error={errors.password} hint="At least 8 characters, with a letter and a number" />
        <Button type="submit" loading={loading} className="btn--block">Sign up</Button>
      </form>
      <p className="auth-card__switch">Already have an account? <Link to="/login">Log in</Link></p>
    </>
  );
}
