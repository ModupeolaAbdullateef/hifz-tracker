import { Route, Routes } from 'react-router-dom'
import Home from './pages/public/Home'
import FindRecord from './pages/public/FindRecord'
import StudentProgress from './pages/public/StudentProgress'
import Certificate from './pages/public/Certificate'
import UsefulDocs from './pages/public/UsefulDocs'
import Login from './pages/staff/Login'
import StaffLayout from './pages/staff/StaffLayout'
import FindStudent from './pages/staff/FindStudent'
import StudentGrid from './pages/staff/StudentGrid'
import ClassWeekView from './pages/staff/ClassWeekView'
import ClassOverview from './pages/staff/ClassOverview'
import ManageStudents from './pages/admin/ManageStudents'
import CourseSettings from './pages/admin/CourseSettings'
import RecordFields from './pages/admin/RecordFields'
import Tips from './pages/admin/Tips'
import Codes from './pages/admin/Codes'
import ExportCsv from './pages/admin/ExportCsv'
import Docs from './pages/admin/Docs'
import Enquiries from './pages/admin/Enquiries'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/record" element={<FindRecord />} />
      <Route path="/record/:studentId" element={<StudentProgress />} />
      <Route path="/certificate/:studentId" element={<Certificate />} />
      <Route path="/docs" element={<UsefulDocs />} />

      <Route path="/staff/login" element={<Login />} />
      <Route path="/staff" element={<StaffLayout />}>
        <Route index element={<FindStudent />} />
        <Route path="student/:studentId" element={<StudentGrid />} />
        <Route path="week" element={<ClassWeekView />} />
        <Route path="overview" element={<ClassOverview />} />
        <Route path="admin/students" element={<ManageStudents />} />
        <Route path="admin/course" element={<CourseSettings />} />
        <Route path="admin/fields" element={<RecordFields />} />
        <Route path="admin/tips" element={<Tips />} />
        <Route path="admin/codes" element={<Codes />} />
        <Route path="admin/export" element={<ExportCsv />} />
        <Route path="admin/docs" element={<Docs />} />
        <Route path="admin/enquiries" element={<Enquiries />} />
      </Route>

      <Route path="*" element={<Home />} />
    </Routes>
  )
}
