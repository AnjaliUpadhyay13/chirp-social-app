import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import FormField from '../components/FormField.jsx';
import Button from '../components/Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { validateLogin, fieldErrorsFromApi } from '../utils/validation.js';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState({ identifier: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { document.title = 'Log in / Chirp'; }, []);

  const set = (k) => (e) => { setValues((v) => ({ ...v, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const onSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const clientErrors = validateLogin(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setLoading(true);
    try {
      const user = await login({ identifier: values.identifier, password: values.password });
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      navigate(location.state?.from || '/', { replace: true });
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
      <h1 className="auth-card__title">Log in</h1>
      <p className="auth-card__sub">Welcome back. Enter your details to continue.</p>
      <form onSubmit={onSubmit} noValidate className="form">
        {formError && <div className="form__alert" role="alert">{formError}</div>}
        <FormField label="Email or username" name="identifier" autoComplete="username" value={values.identifier} onChange={set('identifier')} error={errors.identifier} autoFocus />
        <FormField label="Password" name="password" type="password" autoComplete="current-password" value={values.password} onChange={set('password')} error={errors.password} />
        <Button type="submit" loading={loading} className="btn--block">Log in</Button>
      </form>
      <p className="auth-card__switch">New here? <Link to="/register">Create an account</Link></p>
    </>
  );
}
