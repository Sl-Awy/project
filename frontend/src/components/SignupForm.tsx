import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Lock from "../Img/lock.svg";
import Person from "../Img/person.svg";
import personCircle from "../Img/placeholder-avatar.svg";
import "../CSS/SignupForm.css";
import "../CSS/Laptod.css";

const SignupForm = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Registration: create a new account (email + password)
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Password and password confirmation do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signup(email, password, confirmPassword);
      if (result.success) {
        navigate("/login");
      } else {
        setError(result.error || "Signup failed");
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
      <img className="icon-person" src={personCircle} alt="person" />

      <div className="form-box login">
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
          <div className="input-box">
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <label>conf_password</label>
          </div>
          <button type="submit" className="btn" disabled={isSubmitting}>
            {isSubmitting ? "Signing up..." : "Sign Up"}
          </button>
          <div className="logreg-link">
            <p>Already have an account?</p>
            <Link to="/login" className="register-link">Log In</Link>
          </div>
        </form>
      </div>
      <div className="info-text login">
        <h2>Welcome</h2>
        <p>Enter your email and create a password</p>
      </div>
    </div>
  );
};

export default SignupForm;
