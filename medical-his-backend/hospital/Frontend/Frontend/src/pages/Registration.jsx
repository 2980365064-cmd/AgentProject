import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ErrorAlert from '../components/ErrorAlert';
import { registerUser } from '../services/authService';
import { persistSessionFromAuthResponse, getStoredUser } from '../services/apiClient';
import MedicalParticles from '../components/MedicalParticles';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const Registration = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('PATIENT');
  const [errorMessage, setErrorMessage] = useState('');

  const navigate = useNavigate();

  const handleSignup = async (e) => {
      e.preventDefault();

      const emailLower = email.toLowerCase();

      if (name.trim() === '') { setErrorMessage('姓名不能为空。'); return; }
      if (email.trim() === '') { setErrorMessage('邮箱不能为空。'); return; }
      if (!emailLower.includes('@') || !emailLower.includes('gmail.com')) {
          setErrorMessage('请输入有效的 Gmail 邮箱地址。'); return;
      }
      if (password.trim() === '') { setErrorMessage('密码不能为空。'); return; }
      if (password.length < 6) { setErrorMessage('密码长度至少为 6 位。'); return; }

      try {
          const response = await registerUser(name, email, password, role);

          if (response.status === 'success') {
              setErrorMessage('');
              persistSessionFromAuthResponse(response);

              const u = getStoredUser();
              const hasToken = Boolean(
                u?.token ?? u?.accessToken ?? u?.jwt ?? u?.access_token
              );

              if (hasToken) {
                toast.success("注册成功，已自动登录。");
                navigate('/dashboard');
              } else {
                toast.success("注册成功，请登录。");
                navigate('/login');
              }
          } else {
            setErrorMessage('注册失败，请重试。');
            toast.error("注册失败。");
          }
      // eslint-disable-next-line no-unused-vars
      } catch (error) {
        setErrorMessage('注册失败，请重试。');
        toast.error("服务器错误，请稍后再试。");
      }
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* <MedicalParticles /> */}
      <ErrorAlert 
        message={errorMessage} 
        onClose={() => setErrorMessage('')} 
      />
    
      <div className="w-full min-h-screen flex flex-col items-center justify-center px-4">
        <form noValidate onSubmit={handleSignup} className="md:w-96 w-full flex flex-col items-center justify-center border border-gray-100 rounded-2xl p-10 shadow-sm relative bg-white/90 backdrop-blur-md z-10">
          <h2 className="text-4xl text-gray-900 font-medium">开始使用</h2>
          <p className="text-sm text-gray-500/90 mt-3">创建账号以开始使用系统</p>
    
          {/* Name Input */}
          <div className="flex items-center w-full bg-transparent border border-gray-300/60 h-12 rounded-full overflow-hidden pl-6 gap-2 mt-8">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="#6B7280"/>
            </svg>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="姓名" 
              className="bg-transparent text-black-500/80 placeholder-gray-500/80 outline-none text-sm w-full h-full" 
            />                
          </div>

          {/* Email Input */}
          <div className="flex items-center w-full bg-transparent border border-gray-300/60 h-12 rounded-full overflow-hidden pl-6 gap-2 mt-4">
            <svg width="16" height="11" viewBox="0 0 16 11" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M0 .55.571 0H15.43l.57.55v9.9l-.571.55H.57L0 10.45zm1.143 1.138V9.9h13.714V1.69l-6.503 4.8h-.697zM13.749 1.1H2.25L8 5.356z" fill="#6B7280"/>
            </svg>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="邮箱" 
              className="bg-transparent text-black-500/80 placeholder-gray-500/80 outline-none text-sm w-full h-full" 
            />                
          </div>
    
          {/* Password Input */}
          <div className="flex items-center mt-4 w-full bg-transparent border border-gray-300/60 h-12 rounded-full overflow-hidden pl-6 pr-4 gap-2">
            <svg width="13" height="17" viewBox="0 0 13 17" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13 8.5c0-.938-.729-1.7-1.625-1.7h-.812V4.25C10.563 1.907 8.74 0 6.5 0S2.438 1.907 2.438 4.25V6.8h-.813C.729 6.8 0 7.562 0 8.5v6.8c0 .938.729 1.7 1.625 1.7h9.75c.896 0 1.625-.762 1.625-1.7zM4.063 4.25c0-1.406 1.093-2.55 2.437-2.55s2.438 1.144 2.438 2.55V6.8H4.061z" fill="#6B7280"/>
            </svg>
            <input 
              type={showPassword ? "text" : "password"} 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码" 
              className="bg-transparent text-black-500/80 placeholder-gray-500/80 outline-none text-sm w-full h-full" 
            />
            
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>

          <div className="w-full mt-4">
            <label htmlFor="register-role" className="block text-xs font-semibold text-gray-600 mb-2 pl-1">
              注册身份
            </label>
            <select
              id="register-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full h-12 rounded-full border border-gray-300/60 bg-transparent px-5 text-sm text-gray-800 outline-none appearance-none cursor-pointer hover:border-gray-400 focus:border-blue-600 transition-colors"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.25rem' }}
            >
              <option value="PATIENT">患者</option>
              <option value="ADMIN">管理员</option>
            </select>
          </div>
    
          <button type="submit" className="mt-8 w-full h-11 rounded-full text-white bg-indigo-500 hover:opacity-90 transition-opacity" style={{background: "linear-gradient(135deg,#1e40af,#2563eb)",boxShadow: "0 4px 12px rgba(37,99,235,.35)"}}>
            创建账号
          </button>

          <p className="text-gray-500/90 text-sm mt-4">
            已有账号？<Link className="text-black hover:underline" to="/login">登录</Link>
          </p>
        </form>
      </div>
    </div>
  )
}

export default Registration;