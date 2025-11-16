import ProjectedEarnings from "./ProjectedEarnings"
import VaultAction from "./VaultAction"
import VaultSidebarTab from "./VaultSidebarTab"

const VaultSidebar = () => {
  return (
    <div className='relative p-4 rounded-lg border border-zinc-200 bg-zinc-100 flex flex-col gap-2'>
      <div className='flex flex-col gap-2 p-4 rounded-lg border border-zinc-200 bg-white'>
        {/* TODO: Show the amount of the asset user has deposited */}
        <div className='flex justify-between items-center'>
          <p className='text-sm text-muted-foreground font-medium'>Your Position</p>
          <p className='text-sm font-medium'>0</p>
        </div>
        {/* TODO: Show the amount of the asset user has earned */}
        <div className='flex justify-between items-center'>
          <p className='text-sm text-muted-foreground font-medium'>Amount Earned</p>
          <p className='text-sm font-medium'>0</p>
        </div>
      </div>
      <VaultSidebarTab />
      {/* <ProjectedEarnings /> */}
      <VaultAction />
    </div>
  )
}

export default VaultSidebar
