import Setting12 from "../Settings/Setting12";
import Setting7 from "../Settings/Setting7";
import Setting8 from "../Settings/Setting8";
import Menu from "../components/Menu";
import SearchInput from "../components/SearchInput";

const SettingsPage = () => {
  return (
    <div className="mt-10 gap-4 flex flex-col justify-center items-center px-4 pb-28 w-full">
      <h1 className="font-bold text-3xl text-gray-50">Settings</h1>
      <SearchInput />
      <div className="w-full max-w-2xl">
        <Setting8 />
        <Setting7 />
        <Setting12 />
      </div>
      <Menu />
    </div>
  );
};

export default SettingsPage;
