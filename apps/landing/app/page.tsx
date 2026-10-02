import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Channels } from "@/components/sections/Channels";
import { InboxMockup } from "@/components/sections/InboxMockup";
import { Scope } from "@/components/sections/Scope";
import { Plans } from "@/components/sections/Plans";
import { Faq } from "@/components/sections/Faq";
import { Contact } from "@/components/sections/Contact";

export default function Home() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Channels />
      <InboxMockup />
      <Scope />
      <Plans />
      <Faq />
      <Contact />
    </>
  );
}
