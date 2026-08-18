'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HelpCircle, Check } from 'lucide-react';
import Button from './ui/Button';

interface FacilityCategory {
  title: string;
  items: string[];
}

const facilityCategoryTemplates: FacilityCategory[] = [
  {
    title: 'Community/Recreation',
    items: ['Community Center', 'Gym', 'Pool', 'Sports Complex'],
  },
  {
    title: 'Cultural',
    items: ['Attractions (e.g. zoo)', 'Library', 'Museum/Gallery', 'Visitor Center'],
  },
  {
    title: 'Educational',
    items: ['College/University', 'K-12 School', 'Preschool/Daycare'],
  },
  {
    title: 'Food Service',
    items: ['Banquet Facility', 'Cafeteria', 'Fast Food', 'Restaurant/Café/Bar'],
  },
  {
    title: 'Healthcare',
    items: ['Clinic/Outpatient Medical Office', 'Hospital', 'Nursing Home/Assisted Living'],
  },
  {
    title: 'Retail',
    items: ['Bank', 'Convenience Store', 'Grocery/Food Market', 'Large Retail Store', 'Shopping Mall', 'Store/Boutique'],
  },
  {
    title: 'Warehouse',
    items: ['General', 'Data Center', 'Distribution/Shipping', 'Self-Storage Unit'],
  },
  {
    title: 'Industrial',
    items: ['Manufacturing', 'Power Station/Plant'],
  },
  {
    title: 'Lodging',
    items: ['Dormitory', 'Hotel/Motel/Inn'],
  },
  {
    title: 'Office',
    items: ['Administrative/Professional Office', 'Government Office'],
  },
  {
    title: 'Assembly',
    items: ['Convention Center', 'Entertainment (e.g. concert hall)', 'Stadium/Arena', 'Religious Services'],
  },
  {
    title: 'Public Safety',
    items: ['Police Station', 'Fire/Rescue Station'],
  },
];

const serviceOptions = [
  'Design Review',
  'Facilities Assessment',
  'Design Guidebook Development and Integration',
  'Research',
  'Training',
  'Code Compliance Assessment',
];

const usStates = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah',
  'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
];

const canadianProvinces = [
  'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador',
  'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island',
  'Quebec', 'Saskatchewan', 'Yukon',
];

const getRegionOptions = (country: string) => (
  country === 'Canada' ? canadianProvinces : usStates
);

const fallbackFacilityNames = facilityCategoryTemplates.flatMap((category) => category.items);
const categorizedFacilityNames = new Set(fallbackFacilityNames);

export type ProjectProfileFormData = {
  contactName: string;
  contactEmail: string;
  telephone: string;
  firmName: string;
  ownerName: string;
  projectName: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  buildingArea: string;
  siteArea: string;
  certification: string;
  services: string[];
  facilityUses: string[];
};

const emptyFormData: ProjectProfileFormData = {
  contactName: '',
  contactEmail: '',
  telephone: '',
  firmName: '',
  ownerName: '',
  projectName: '',
  address1: '',
  address2: '',
  city: '',
  state: '',
  zip: '',
  country: 'United States',
  buildingArea: '',
  siteArea: '',
  certification: 'Guided Certification',
  services: [],
  facilityUses: [],
};

type ProjectProfileFormProps = {
  mode?: 'create' | 'edit';
  projectId?: string;
  initialData?: Partial<ProjectProfileFormData>;
  onCreateDraft?: (data: ProjectProfileFormData) => void;
};

export default function ProjectProfileForm({
  mode = 'create',
  projectId,
  initialData,
  onCreateDraft,
}: ProjectProfileFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facilityNames, setFacilityNames] = useState<string[]>(fallbackFacilityNames);
  const [formData, setFormData] = useState<ProjectProfileFormData>({
    ...emptyFormData,
    ...initialData,
    services: initialData?.services || [],
    facilityUses: initialData?.facilityUses || [],
  });

  useEffect(() => {
    let isMounted = true;

    const loadFacilityUses = async () => {
      try {
        const response = await fetch('/api/facility-uses');
        if (!response.ok) return;

        const data = await response.json();
        const names = Array.isArray(data)
          ? data.map((facility) => facility.name).filter((name): name is string => typeof name === 'string')
          : [];

        if (isMounted && names.length > 0) {
          setFacilityNames(names);
        }
      } catch {
        // Keep seeded fallback names available if the option endpoint is unreachable.
      }
    };

    loadFacilityUses();

    return () => {
      isMounted = false;
    };
  }, []);

  const facilityCategories = useMemo(() => {
    const availableNames = new Set(facilityNames);
    const grouped = facilityCategoryTemplates
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => availableNames.has(item)),
      }))
      .filter((category) => category.items.length > 0);
    const otherItems = facilityNames.filter((name) => !categorizedFacilityNames.has(name));

    return otherItems.length > 0 ? [...grouped, { title: 'Other', items: otherItems }] : grouped;
  }, [facilityNames]);

  const regionOptions = getRegionOptions(formData.country);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      if (name === 'country') {
        const nextRegions = getRegionOptions(value);
        return { ...prev, country: value, state: nextRegions.includes(prev.state) ? prev.state : '' };
      }

      return { ...prev, [name]: value };
    });
  };

  const handleCheckboxChange = (name: 'services' | 'facilityUses', item: string) => {
    setFormData((prev) => {
      if (name === 'services' && item === 'Select All') {
        const hasAll = serviceOptions.every((service) => prev.services.includes(service));
        return { ...prev, services: hasAll ? [] : [...serviceOptions] };
      }

      const current = prev[name];
      const next = current.includes(item)
        ? current.filter((i) => i !== item)
        : [...current, item];
      return { ...prev, [name]: next };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode !== 'edit' && onCreateDraft) {
      onCreateDraft(formData);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(mode === 'edit' && projectId ? `/api/projects/${projectId}` : '/api/projects', {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create project');
      }

      const data = await response.json();
      router.push(`/projects/${data.id}`);
      router.refresh();
    } catch (err: any) {
      console.error('Project save error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-12 pb-20">
      
      {error && (
        <div role="alert" className="bg-red-50 text-red-600 px-6 py-4 rounded border border-red-100 text-sm font-bold uppercase tracking-wide">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        {/* Section 1: Contact Information */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full border-2 border-slate-800 flex items-center justify-center font-bold text-lg">1</div>
             <h3 className="text-xl font-bold text-slate-800">Contact Information</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600">Primary Contact Name (first and last) <span className="text-red-500">*</span></label>
              <p className="text-xs text-slate-400">The point of contact the isUD team should reach out to about this project</p>
              <input type="text" name="contactName" value={formData.contactName} onChange={handleInputChange} placeholder="Primary Contact Person" className="w-full border border-slate-300 rounded px-4 py-2 text-sm focus:ring-2 focus:ring-secondary outline-none" required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600">Primary E-mail <span className="text-red-500">*</span></label>
              <input type="email" name="contactEmail" value={formData.contactEmail} onChange={handleInputChange} placeholder="Primary Contact E-mail" className="w-full border border-slate-300 rounded px-4 py-2 text-sm focus:ring-2 focus:ring-secondary outline-none" required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600">Primary Telephone <span className="text-red-500">*</span></label>
              <div className="flex">
                <div className="bg-slate-50 border border-slate-300 border-r-0 rounded-l px-3 flex items-center gap-2">
                   <span className="text-lg">🇺🇸</span>
                   <span className="text-xs text-slate-400">▼</span>
                </div>
                <input type="tel" name="telephone" value={formData.telephone} onChange={handleInputChange} placeholder="(201) 555-5555" className="w-full border border-slate-300 rounded-r px-4 py-2 text-sm focus:ring-2 focus:ring-secondary outline-none" required />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600">Architect/Firm Name</label>
              <input type="text" name="firmName" value={formData.firmName} onChange={handleInputChange} placeholder="Project Architect" className="w-full border border-slate-300 rounded px-4 py-2 text-sm focus:ring-2 focus:ring-secondary outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600">Owner's Name</label>
              <p className="text-xs text-slate-400">The building or facility owner, if different from the primary contact</p>
              <input type="text" name="ownerName" value={formData.ownerName} onChange={handleInputChange} placeholder="Project Owner" className="w-full border border-slate-300 rounded px-4 py-2 text-sm focus:ring-2 focus:ring-secondary outline-none" />
            </div>
          </div>
        </div>

        {/* Section 2: Project Information */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full border-2 border-slate-800 flex items-center justify-center font-bold text-lg">2</div>
             <h3 className="text-xl font-bold text-slate-800">Project Information</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600">Project Name <span className="text-red-500">*</span></label>
              <input type="text" name="projectName" value={formData.projectName} onChange={handleInputChange} placeholder="Project Title" className="w-full border border-slate-300 rounded px-4 py-2 text-sm focus:ring-2 focus:ring-secondary outline-none" required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600">Address Line 1</label>
              <input type="text" name="address1" value={formData.address1} onChange={handleInputChange} placeholder="Project Address Line 1" className="w-full border border-slate-300 rounded px-4 py-2 text-sm focus:ring-2 focus:ring-secondary outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600">Address Line 2</label>
              <input type="text" name="address2" value={formData.address2} onChange={handleInputChange} placeholder="Project Address Line 2" className="w-full border border-slate-300 rounded px-4 py-2 text-sm focus:ring-2 focus:ring-secondary outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">City</label>
                <input type="text" name="city" value={formData.city} onChange={handleInputChange} placeholder="City" className="w-full border border-slate-300 rounded px-4 py-2 text-sm focus:ring-2 focus:ring-secondary outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">State/Province</label>
                <select name="state" value={formData.state} onChange={handleInputChange} className="w-full border border-slate-300 rounded px-4 py-2 text-sm focus:ring-2 focus:ring-secondary outline-none bg-white">
                  <option value="">{formData.country === 'Canada' ? '- Province/Territory -' : '- State -'}</option>
                  {regionOptions.map((region) => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">ZIP/Postal code</label>
                <input type="text" name="zip" value={formData.zip} onChange={handleInputChange} placeholder="ZIP Code" className="w-full border border-slate-300 rounded px-4 py-2 text-sm focus:ring-2 focus:ring-secondary outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">Country</label>
                <select name="country" value={formData.country} onChange={handleInputChange} className="w-full border border-slate-300 rounded px-4 py-2 text-sm focus:ring-2 focus:ring-secondary outline-none bg-white">
                  <option>United States</option>
                  <option>Canada</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
               <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <label className="text-sm font-medium text-slate-600">Building Area</label>
                    <span title="The total habitable floor area of the building, in square feet.">
                      <HelpCircle size={14} className="text-slate-400" />
                    </span>
                  </div>
                  <div className="flex">
                    <input type="text" name="buildingArea" value={formData.buildingArea} onChange={handleInputChange} placeholder="sq. ft" className="w-full border border-slate-300 rounded px-4 py-2 text-sm focus:ring-2 focus:ring-secondary outline-none" />
                  </div>
               </div>
               <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <label className="text-sm font-medium text-slate-600">Site Area</label>
                    <span title="The total area of the project site, in acres.">
                      <HelpCircle size={14} className="text-slate-400" />
                    </span>
                  </div>
                  <div className="flex">
                    <input type="text" name="siteArea" value={formData.siteArea} onChange={handleInputChange} placeholder="acres" className="w-full border border-slate-300 rounded px-4 py-2 text-sm focus:ring-2 focus:ring-secondary outline-none" />
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Section 3: Potential Services Needed */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full border-2 border-slate-800 flex items-center justify-center font-bold text-lg">3</div>
             <h3 className="text-xl font-bold text-slate-800">Potential Services Needed</h3>
          </div>
          <p className="text-[13px] text-slate-600 leading-tight">
            Beyond certification, the isUD team offers additional <span className="text-[#002a54] font-bold">isUD services</span> such as design reviews, facility assessments, and training. Select any you'd like our team to follow up with you about &mdash; this won't affect your certification progress.
          </p>

          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                Would you like isUD Certification? <span className="text-red-500">*</span>
                <a
                  href="https://thisisud.com/services/"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Learn more about Guided Certification vs. Certification Only"
                  aria-label="Learn more about Guided Certification vs. Certification Only (opens in a new tab)"
                >
                  <HelpCircle size={14} className="text-slate-400 hover:text-secondary" />
                </a>
              </label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="certification" value="Guided Certification" checked={formData.certification === 'Guided Certification'} onChange={handleInputChange} className="w-4 h-4 text-secondary focus:ring-secondary border-slate-300" />
                  <span className="text-sm text-slate-700">Guided Certification</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="certification" value="Certification Only" checked={formData.certification === 'Certification Only'} onChange={handleInputChange} className="w-4 h-4 text-secondary focus:ring-secondary border-slate-300" />
                  <span className="text-sm text-slate-700">Certification Only</span>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  Are you interested in any other isUD services?
                  <a
                    href="https://thisisud.com/services/"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Learn more about isUD services"
                    aria-label="Learn more about isUD services (opens in a new tab)"
                  >
                    <HelpCircle size={14} className="text-slate-400 hover:text-secondary" />
                  </a>
                </label>
                <label className="flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer group text-sm text-slate-600 font-medium">
                  {(() => {
                    const allChecked = serviceOptions.every((option) => formData.services.includes(option));
                    return (
                      <>
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={allChecked}
                          onChange={() => handleCheckboxChange('services', 'Select All')}
                        />
                        <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-secondary peer-focus-visible:ring-offset-2 ${
                          allChecked ? 'bg-secondary border-secondary' : 'bg-slate-100 border-slate-300 group-hover:border-slate-400'
                        }`}>
                          {allChecked && <Check size={12} className="text-white" aria-hidden="true" />}
                        </span>
                        Select All
                      </>
                    );
                  })()}
                </label>
              </div>
              <div className="space-y-2">
                {serviceOptions.map((service) => (
                  <label key={service} className="flex items-center gap-2 cursor-pointer group">
                    {(() => {
                      const checked = formData.services.includes(service);
                      return (
                        <>
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={checked}
                            onChange={() => handleCheckboxChange('services', service)}
                          />
                          <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-secondary peer-focus-visible:ring-offset-2 ${
                            checked
                        ? 'bg-secondary border-secondary'
                        : 'bg-slate-100 border-slate-300 group-hover:border-slate-400'
                          }`}>
                            {checked && <Check size={12} className="text-white" aria-hidden="true" />}
                          </span>
                        </>
                      );
                    })()}
                    <span className="text-sm text-slate-700">{service}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Facility Uses */}
      <div className="space-y-8 pt-12 border-t border-slate-200">
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 rounded-full border-2 border-slate-800 flex items-center justify-center font-bold text-lg">4</div>
           <div className="flex items-baseline gap-2">
             <h3 className="text-xl font-bold text-slate-800">Facility Uses</h3>
             <span className="text-[13px] text-slate-600">(Select all that apply)</span>
           </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-x-8 gap-y-10">
          {facilityCategories.map((category) => (
            <div key={category.title} className="space-y-3">
               <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-1">{category.title}</h4>
               <div className="space-y-2">
                  {category.items.map((item) => (
                    <label key={item} className="flex items-start gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={formData.facilityUses.includes(item)}
                        onChange={() => handleCheckboxChange('facilityUses', item)}
                      />
                      <span className={`mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-secondary peer-focus-visible:ring-offset-2 ${formData.facilityUses.includes(item) ? 'bg-secondary border-secondary' : 'bg-slate-100 border-slate-300 group-hover:border-slate-400'}`}>
                        {formData.facilityUses.includes(item) && <Check size={12} className="text-white" aria-hidden="true" />}
                      </span>
                      <span className="text-xs text-slate-700 leading-tight">{item}</span>
                    </label>
                  ))}
               </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end items-center gap-4 pt-12">
        <Button 
          type="button" 
          variant="secondary" 
          className="bg-[#002a54] hover:bg-[#001d3d] text-white px-8" 
          onClick={() => router.push(mode === 'edit' && projectId ? `/projects/${projectId}` : '/')}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          variant="primary" 
          className="bg-[#002a54] hover:bg-[#001d3d] px-10 disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : mode === 'edit' ? 'Save Changes' : onCreateDraft ? 'Continue' : 'Save'}
        </Button>
      </div>

    </form>
  );
}
