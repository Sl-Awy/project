import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const Setting8 = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
      await logout();
      navigate("/login");
    };

    return (
      <div
        className="w-full flex items-center justify-between border-b py-2 cursor-pointer"
        onClick={handleLogout}
      >
        <div className="flex h-12 gap-4 items-center">
          <div className="button8 rounded cursor-pointer  w-10 h-10 flex justify-center items-center">
            L
          </div>
          <span className="text-gray-100">Log out of your account</span>
        </div>
        <span className="arrow text-gray-400 text-3xl">{">"}</span>
      </div>
    );
  };
  
  export default Setting8;
  