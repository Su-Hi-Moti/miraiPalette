import { useEffect } from 'react'
import ChildView from './ChildView'
import ParentReport from './ParentReport'
import FacilitatorView from './FacilitatorView'

const rolePaths = {
  child: '/child',
  parent: '/parent',
  facilitator: '/facilitator',
}

function RoleRouter({ role }) {
  const expectedPath = rolePaths[role]

  useEffect(() => {
    if (expectedPath && window.location.pathname !== expectedPath) {
      window.history.replaceState({}, '', expectedPath)
    }
  }, [expectedPath])

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