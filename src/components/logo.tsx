import { cn } from "@/lib/utils"
import Image from "next/image"
import Link from "next/link"

const Logo = () => {
  return (
    <Link href={`/`} className='font-normal flex space-x-2 items-center text-sm mr-4 relative z-20'>
      <div className='relative h-8 w-8'>
        <Image
          src={"/images/logo-icon.png"}
          alt={"logo"}
          width={400}
          height={400}
          className='h-full w-full object-contain object-center rounded-sm'
        />
      </div>
      <p className={cn("text-sm hidden md:block font-medium text-zinc-900 dark:text-white")}>
        Kivon Hedera Bridge
      </p>
    </Link>
  )
}

export default Logo
