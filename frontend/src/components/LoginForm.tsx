import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../CSS/LoginForm.css";
import "../CSS/Laptod.css";
import Lock from "../Img/lock.svg";
import Person from "../Img/person.svg";

const LoginForm = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        navigate("/");
      } else {
        setError(result.error || "Login failed");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="wrapper">
      <span className="bg-animate"></span>

      <div className="form-box login">
        <h2>Login</h2>
        <form action="#" onSubmit={onSubmit}>
          {error && (
            <p className="text-red-400 text-sm text-center mb-2">{error}</p>
          )}
          <div className="input-box">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label>Email</label>
            <img className="icon" src={Person} alt="person" />
          </div>
          <div className="input-box">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label>Password</label>
            <img className="icon" src={Lock} alt="lock" />
          </div>
          <button type="submit" className="btn" disabled={isSubmitting}>
            {isSubmitting ? "Logging in..." : "Login"}
          </button>
          <div className="logreg-link">
            <p>Don't have an account?</p>
            <Link to="/signup" className="register-link">Sign Up</Link>
          </div>

          <button type="button" className="btn1">Connect with Google</button>
          <button type="button" className="btn2">Connect with Facebook</button>
        </form>
      </div>
      <div className="info-text login">
        <h2>Welcome Back!</h2>
        <p>Enter your email and password</p>
      </div>
    </div>
  );
};

export default LoginForm;
