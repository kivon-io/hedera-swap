import { Separator } from "../ui/separator"
import VaultSidebarTab from "./VaultSidebarTab"

const VaultSidebar = () => {
  return (
    <div className='relative p-4 rounded-lg border border-zinc-200 bg-zinc-100 flex flex-col gap-2'>
      <div className='flex flex-col p-4 rounded-lg border border-zinc-200 bg-white'>
        <div className='flex justify-between items-center'>
          <p className='text-sm text-muted-foreground font-medium'>Your Position</p>
          <p className='text-sm font-medium'>0</p>
        </div>
        <Separator />
      </div>
      <VaultSidebarTab />
    </div>
  )
}

export default VaultSidebar
