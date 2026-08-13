import axios from 'axios';

const request = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1',
  withCredentials: true,
  timeout: 15000,
});

request.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.data) {
      return err.response.data;
    }
    return { code: -1, message: err.message };
  },
);

export default request;
