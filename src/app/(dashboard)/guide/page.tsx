import Breadcrumbs from '@/components/ui/Breadcrumbs';
import Accordion from '@/components/ui/Accordion';
import Link from 'next/link';

import { 
  FileText, 
  Image as ImageIcon, 
  CheckCircle2, 
  Info,
  ChevronRight,
  Calculator,
  FileSearch,
  CheckCircle
} from 'lucide-react';

const ExampleBox = ({ children, title = "Example" }: { children: React.ReactNode; title?: string }) => (
  <div className="my-6 border-l-4 border-secondary bg-slate-50 p-5 rounded-r-sm">
    <div className="text-secondary font-bold text-sm uppercase tracking-wider mb-2">{title}</div>
    <div className="text-slate-700 space-y-2 text-[15px]">
      {children}
    </div>
  </div>
);

const LegendRow = ({ icon: Icon, label, description }: { icon: any, label: string, description: string }) => (
  <div className="flex gap-4 items-start py-3 border-b border-slate-50 last:border-0">
    <div className="shrink-0 w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded text-primary">
      <Icon size={18} />
    </div>
    <div className="space-y-1">
      <div className="font-bold text-slate-800 text-sm">{label}</div>
      <div className="text-slate-600 text-sm leading-relaxed">{description}</div>
    </div>
  </div>
);

const guideItems = [
  {
    question: 'How do I navigate the solutions?',
    answer: (
      <div className="space-y-6">
        <p>
          You can navigate the 500+ Universal Design solutions by using the category filters on the main solutions page.
          The solutions are organized into 9 chapters: Design Process, Space Clearances, Circulation, Environmental Quality,
          Site, Rooms and Spaces, Furnishings and Equipment, Services, and Policies.
        </p>
        
        <div className="space-y-4">
          <h4 className="font-bold text-primary text-sm uppercase tracking-wide">Browsing symbols</h4>
          <div className="bg-slate-50 border border-slate-100 rounded-sm p-2">
            <LegendRow 
              icon={ImageIcon} 
              label="Drawing / Figure" 
              description="Click on this symbol to see a corresponding drawing or figure to help illustrate the criteria." 
            />
            <LegendRow 
              icon={FileText} 
              label="Research PDF" 
              description="Click on this symbol to read more about the research that supports this solution." 
            />
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-bold text-primary text-sm uppercase tracking-wide">Editing symbols</h4>
          <div className="bg-slate-50 border border-slate-100 rounded-sm p-2">
            <div className="flex gap-4 items-start py-3 border-b border-slate-50">
              <div className="shrink-0 w-12 h-6 bg-secondary rounded-full relative flex items-center px-1">
                <div className="w-4 h-4 bg-white rounded-full ml-auto" />
              </div>
              <div className="space-y-1">
                <div className="font-bold text-slate-800 text-sm">Yes / No toggle switch</div>
                <div className="text-slate-600 text-sm leading-relaxed">
                  Designers can select to implement a solution by clicking this switch. The counts at the bottom 
                  and the top of each page update as you select solutions.
                </div>
              </div>
            </div>
            <div className="flex gap-4 items-start py-3 border-b border-slate-50">
              <div className="shrink-0 w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded font-bold text-xs text-slate-400">#</div>
              <div className="space-y-1">
                <div className="font-bold text-slate-800 text-sm">Number of solutions</div>
                <div className="text-slate-600 text-sm leading-relaxed">This tells the total number of solutions within a section.</div>
              </div>
            </div>
            <div className="flex gap-4 items-start py-3 border-b border-slate-50">
              <div className="shrink-0 w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded font-bold text-xs text-primary">C</div>
              <div className="space-y-1">
                <div className="font-bold text-slate-800 text-sm">Credit counts</div>
                <div className="text-slate-600 text-sm leading-relaxed">This tells the total number of credits possible in a section.</div>
              </div>
            </div>
            <div className="flex gap-4 items-start py-3 border-b border-slate-50">
              <div className="shrink-0 w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded font-bold text-xs text-primary shadow-[inset_0_0_0_2px_rgba(0,42,84,1)]">C</div>
              <div className="space-y-1">
                <div className="font-bold text-slate-800 text-sm">Bold number</div>
                <div className="text-slate-600 text-sm leading-relaxed">A bold number indicates how many credits have been achieved in a section.</div>
              </div>
            </div>
            <div className="flex gap-4 items-start py-3">
              <div className="shrink-0 w-12 h-8 flex items-center justify-center bg-primary rounded text-white font-bold text-xs">SCORE</div>
              <div className="space-y-1">
                <div className="font-bold text-slate-800 text-sm">Black background</div>
                <div className="text-slate-600 text-sm leading-relaxed">The count at the top and bottom of the page informs the designer how many credits have been selected and successfully achieved.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    question: 'How are projects scored and evaluated?',
    answer: (
      <ul className="space-y-4 list-none">
        {[
          "Solutions are weighted based on their impact on human performance according to the 8 Goals of Universal Design.",
          "Credit for any section is achieved when the required number of solutions are selected within a section.",
          "Project score is calculated by dividing total credits earned by total credits available, expressed as a number out of 100.",
          "Bonus credits can be earned for implementing a higher number of solutions within an applicable section.",
          "Some solutions are required for isUD Certification and some sections are not applicable to every project.",
          "isUD does not allow for partial credit. A solution is either implemented or it is not.",
          "Implementation of 500+ solutions provides the flexibility to create customized universal design goals for each unique project."
        ].map((item, i) => (
          <li key={i} className="flex gap-3">
            <CheckCircle2 size={18} className="text-secondary shrink-0 mt-1" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    question: 'Which credits are available for my project?',
    answer: (
      <div className="space-y-4">
        <p>Available credits depend on the facility uses you selected during the project profile setup. The system filters solutions to show only those applicable to your specific project type.</p>
        <ul className="space-y-3 list-none">
          <li className="flex gap-3">
            <ChevronRight size={18} className="text-secondary shrink-0 mt-1" />
            <span>If you implement 55-60 total isUD credits, your project is eligible for isUD Silver certification.</span>
          </li>
          <li className="flex gap-3">
            <ChevronRight size={18} className="text-secondary shrink-0 mt-1" />
            <span>Only solutions within sections applicable to your project will count towards your score.</span>
          </li>
        </ul>
      </div>
    ),
  },
  {
    question: 'How does my project earn credit?',
    answer: (
      <div className="space-y-4">
        <p>
          Each section contains solutions that have a credit value of 1, 2, or 3. 
          To earn credit in a section, you must implement the required number of solutions.
        </p>
        <ExampleBox>
          <div className="font-bold mb-1 italic">Example Section: Level Entry Cabinets</div>
          <div>Total solutions in section: <strong>7</strong></div>
          <div>Credit value for this section: <strong>2</strong></div>
          <div className="pt-2">Requirement: You must implement at least <strong>4</strong> solutions in this section in order to earn <strong>2</strong> credits.</div>
        </ExampleBox>
        <p>
          Additionally, some solutions in isUD are linked. If you implement a solution that requires 
          a second supporting solution, the second solution is automatically counted for you.
        </p>
      </div>
    ),
  },
  {
    question: 'How can my project earn bonus credits?',
    answer: (
      <div className="space-y-4">
        <p>
          Bonus credits are earned by going above and beyond the minimum requirements in a section. 
          For every 5 solutions you implement in a section beyond the required amount, you earn 
          <strong> 1 bonus credit</strong>.
        </p>
        <div className="bg-slate-50 border border-slate-100 rounded p-4 flex gap-4 items-center">
          <Calculator className="text-secondary shrink-0" size={24} />
          <p className="text-sm italic">
            Note: Projects can earn up to a maximum of 10 bonus credits to offset any sections where credit was not earned.
          </p>
        </div>
      </div>
    ),
  },
  {
    question: 'How do required solutions affect my project?',
    answer: (
      <div className="space-y-4">
        <p>
          Certain solutions are marked as <strong>REQUIRED</strong>. These are essential features that 
          must be implemented for a project to qualify for any level of isUD Certification.
        </p>
        <div className="flex gap-3 bg-amber-50 border border-amber-100 p-4 rounded text-amber-900 text-sm">
          <Info size={18} className="shrink-0 mt-0.5" />
          <p>Failure to implement a required solution that is applicable to your project type will prevent you from achieving certification, regardless of your total score.</p>
        </div>
      </div>
    ),
  },
  {
    question: 'How are repeated building elements handled?',
    answer: (
      <div className="space-y-4">
        <p>
          Certain spaces and elements repeat many times in a project. For example, multiple toilet 
          and bathing rooms, sleeping rooms, and workstations may exist in a project. Unless otherwise 
          specified, each solution listed applies to all elements in the space.
        </p>
        
        <ExampleBox>
          <div className="italic mb-2">Solution: "Lavatories have automatic faucets, or are operated following a common conceptual model."</div>
          <p className="text-sm">This applies to <strong>ALL</strong> lavatories in the project unless specified otherwise.</p>
        </ExampleBox>

        <ExampleBox>
          <div className="italic mb-2">Solution: "Selected lavatories and counters are adjustable in height."</div>
          <p className="text-sm">
            This example solution has a more narrow scope. It allows the designer to select certain 
            lavatories and counters to be adjustable in height. The selection process must be intentional 
            and equitable. The "selected" lavatories cannot be only in the Men's toilet rooms, for example.
          </p>
        </ExampleBox>

        <p>
          Other solutions might specify, "at least one," or "at least 50%." If the scope of the solution 
          is unclear, assume it applies to "all."
        </p>
      </div>
    ),
  },
  {
    question: 'What is the minimum score for isUD Certification?',
    answer: (
      <div className="space-y-4">
        <p>
          To qualify for isUD Certification, a project must implement enough solutions to earn 1 credit 
          in every applicable section or earn enough bonus credits to offset any sections where credit was not earned.
        </p>
        <p>
          Typically, the minimum threshold for certification is <strong>70-75</strong>, but it is possible 
          for the threshold to be higher or lower depending on the specific combination of sections 
          applicable to a given project.
        </p>
        <div className="p-4 bg-slate-50 border border-slate-100 rounded flex gap-4 items-center">
          <CheckCircle className="text-secondary shrink-0" size={20} />
          <p className="text-sm">The minimum score for certification is simply a count of the number of sections marked "yes".</p>
        </div>
      </div>
    ),
  },
  {
    question: 'How is the project score calculated?',
    answer: (
      <div className="space-y-4">
        <p>
          The project score is calculated by adding the number of credits earned, dividing by the number 
          of available credits, multiplying by 100, and then adding any bonus credits.
        </p>
        <div className="bg-primary text-white p-6 rounded-sm text-center font-mono text-lg shadow-inner">
          (Credits Earned / Available Credits) × 100 + Bonus
        </div>
        <p className="text-sm text-center text-slate-500 italic">Up to a maximum of 10 bonus credits can be added to the final score.</p>
      </div>
    ),
  },
  {
    question: 'What if I am not sure of the meaning of a solution or how it will be interpreted for scoring?',
    answer: (
      <div className="space-y-4">
        <p>The solutions have been carefully worded to convey a certain meaning and to minimize subjective interpretation. However, the following conventions apply:</p>
        <ol className="space-y-4 list-decimal pl-5">
          <li>
            <strong>Specific vs General:</strong> Where specific criteria differ from more general criteria, the specific criteria shall apply. 
            In any case where solutions conflict with drawings, images, or documents, the most stringent criteria apply.
          </li>
          <li>
            <strong>Singular/Plural:</strong> Words used in the singular include the plural, and those used in the plural include the singular.
          </li>
          <li>
            <strong>Definitions:</strong> The meaning of terms not specifically defined shall be as defined by collegiate dictionaries in the sense that the context implies.
          </li>
          <li>
            <strong>Tolerances:</strong> Conventional industry tolerances do not apply to dimensions given. Designers should plan for construction tolerances in the design.
          </li>
        </ol>
        <p className="pt-2 border-t border-slate-100">
          The isUD team is solely responsible for final interpretation. Any questions should be addressed with the team. 
          <Link href="mailto:info@isud.edu" className="text-secondary hover:underline font-bold px-1 mx-1">Contact us</Link>.
        </p>
      </div>
    ),
  },
  {
    question: 'What documents must be submitted to earn isUD Certification?',
    answer: (
      <div className="space-y-4">
        <p>
          isUD Certification requires contracting with the isUD team to provide the isUD Certification service. 
          The isUD team member assigned to your project will inform you what documents are necessary to provide 
          a thorough and accurate review.
        </p>
        <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm flex gap-4 items-start">
          <FileSearch className="text-primary mt-1 shrink-0" size={20} />
          <p className="text-sm leading-relaxed italic">
            Ultimately, a site-visit post construction may be necessary to verify all of the requirements 
            for isUD Certification have been satisfied.
          </p>
        </div>
        <p>
          For the best chances of successful isUD Certification, 
          <Link href="mailto:info@isud.edu" className="text-secondary hover:underline font-bold px-1 mx-1">contact us</Link> 
          to set up a consultation with an isUD team member.
        </p>
      </div>
    ),
  },
];

export default function UserGuidePage() {
  const breadcrumbItems = [
    { label: 'My Projects', href: '/' },
    { label: 'User Guide' },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <Breadcrumbs items={breadcrumbItems} />
      
      <div className="bg-white border border-slate-200 rounded-sm px-6 py-4 flex items-center shadow-sm">
        <h1 className="text-xl font-bold text-primary tracking-tight">User Guide</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden p-6 sm:p-10 space-y-8">
        <div className="space-y-4">
          <p className="text-slate-600 leading-relaxed text-[15px]">
            This guide explains how the isUD Wishlist and isUD Certification scoring system works.
            The scoring and credits may sound complicated, but the good news is that the website does
            all the math for you and you do not need to do it alone.
            <Link href="mailto:info@isud.edu" className="text-secondary hover:underline font-bold px-1 mx-1">
              Contact us
            </Link> 
            to work with a Universal Design expert who can guide you through a project, 
            and ensure your project contains all the necessary elements to earn isUD Certification.
          </p>
        </div>

        <div className="pt-2">
          <Accordion items={guideItems} />
        </div>
      </div>
    </div>
  );
}
