import ChildView from './ChildView'
import ParentReport from './ParentReport'
import FacilitatorView from './FacilitatorView'

function RoleRouter({ role }) {
  if (role === 'child') {
    return <ChildView />
  }

  if (role === 'parent') {
    return <ParentReport />
  }

  if (role === 'facilitator') {
    return <FacilitatorView />
  }

  return <main>このアカウントの権限を確認できませんでした。</main>
}

export default RoleRouter