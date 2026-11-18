import { Route, Routes } from 'react-router-dom'
import Home from './pages/public/Home'
import MyRecord from './pages/public/MyRecord'
import UsefulDocs from './pages/public/UsefulDocs'
import Login from './pages/hifdh/Login'
import StaffLayout from './pages/hifdh/StaffLayout'
import Record from './pages/hifdh/Record'
import Overview from './pages/hifdh/Overview'
import ThisWeek from './pages/hifdh/ThisWeek'
import Reminders from './pages/hifdh/Reminders'
import StudentPage from './pages/hifdh/StudentPage'
import StudentRecord from './pages/hifdh/StudentRecord'
import Students from './pages/hifdh/admin/Students'
import Registration from './pages/hifdh/admin/Registration'
import Partners from './pages/hifdh/admin/Partners'
import Terms from './pages/hifdh/admin/Terms'
import Teachers from './pages/hifdh/admin/Teachers'
import Import from './pages/hifdh/admin/Import'
import Export from './pages/hifdh/admin/Export'
import Audit from './pages/hifdh/admin/Audit'
import Codes from './pages/hifdh/admin/Codes'
import Tips from './pages/admin/Tips'
import Docs from './pages/admin/Docs'
import Enquiries from './pages/admin/Enquiries'
import PageFeedback from './components/PageFeedback'

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/record" element={<MyRecord />} />
        <Route path="/docs" element={<UsefulDocs />} />
        {/* A student's personal link: #/s/<link token>, opened with their PIN. */}
        <Route path="/s/:link" element={<StudentRecord />} />

        <Route path="/staff/login" element={<Login />} />
        <Route path="/staff" element={<StaffLayout />}>
          <Route index element={<Record />} />
          <Route path="overview" element={<Overview />} />
          <Route path="week" element={<ThisWeek />} />
          <Route path="reminders" element={<Reminders />} />
          <Route path="student/:studentId" element={<StudentPage />} />
          <Route path="admin/students" element={<Students />} />
          <Route path="admin/registration" element={<Registration />} />
          <Route path="admin/partners" element={<Partners />} />
          <Route path="admin/terms" element={<Terms />} />
          <Route path="admin/teachers" element={<Teachers />} />
          <Route path="admin/import" element={<Import />} />
          <Route path="admin/export" element={<Export />} />
          <Route path="admin/audit" element={<Audit />} />
          <Route path="admin/codes" element={<Codes />} />
          <Route path="admin/tips" element={<Tips />} />
          <Route path="admin/docs" element={<Docs />} />
          <Route path="admin/enquiries" element={<Enquiries />} />
        </Route>

        <Route path="*" element={<Home />} />
      </Routes>
      {/* TEMPORARY: per-page review feedback — remove once reviews are done */}
      <PageFeedback />
    </>
  )
}
