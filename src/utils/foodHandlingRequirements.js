// Food handling requirements by country

export const getFoodHandlingRequirements = (countryCode) => {
  const requirements = {
    // United Kingdom
    'GB': {
      countryName: 'United Kingdom',
      certificateName: 'Food Hygiene Certificate',
      certificateDescription: 'Level 2 Food Safety and Hygiene Certificate',
      registrationFormRequired: true,
      registrationFormName: 'Council Registration Form',
      formFields: {
        businessName: { required: true, label: 'Business Name' },
        businessAddress: { required: true, label: 'Business Address' },
        contactPerson: { required: true, label: 'Contact Person' },
        phoneNumber: { required: true, label: 'Phone Number' },
        emailAddress: { required: true, label: 'Email Address' },
        typeOfFoodBusiness: { required: true, label: 'Type of Food Business' },
        operatingHours: { required: false, label: 'Operating Hours' },
        numberOfEmployees: { required: false, label: 'Number of Employees' },
        foodSafetyOfficer: { required: false, label: 'Food Safety Officer' }
      }
    },

    // United States
    'US': {
      countryName: 'United States',
      certificateName: 'Food Handler Permit',
      certificateDescription: 'ServSafe Food Handler Certificate or equivalent state certification',
      registrationFormRequired: true,
      registrationFormName: 'Health Department Registration',
      formFields: {
        businessName: { required: true, label: 'Business Name' },
        businessAddress: { required: true, label: 'Business Address' },
        contactPerson: { required: true, label: 'Contact Person' },
        phoneNumber: { required: true, label: 'Phone Number' },
        emailAddress: { required: true, label: 'Email Address' },
        typeOfFoodBusiness: { required: true, label: 'Type of Food Business' },
        operatingHours: { required: false, label: 'Operating Hours' },
        numberOfEmployees: { required: false, label: 'Number of Employees' },
        foodSafetyManager: { required: true, label: 'Certified Food Safety Manager' },
        healthDepartmentDistrict: { required: true, label: 'Health Department District' }
      }
    },

    // Canada
    'CA': {
      countryName: 'Canada',
      certificateName: 'Food Handler Certificate',
      certificateDescription: 'Provincial Food Handler Certificate (varies by province)',
      registrationFormRequired: true,
      registrationFormName: 'Health Authority Registration',
      formFields: {
        businessName: { required: true, label: 'Business Name' },
        businessAddress: { required: true, label: 'Business Address' },
        contactPerson: { required: true, label: 'Contact Person' },
        phoneNumber: { required: true, label: 'Phone Number' },
        emailAddress: { required: true, label: 'Email Address' },
        typeOfFoodBusiness: { required: true, label: 'Type of Food Business' },
        province: { required: true, label: 'Province/Territory' },
        operatingHours: { required: false, label: 'Operating Hours' },
        numberOfEmployees: { required: false, label: 'Number of Employees' },
        foodSafetyManager: { required: false, label: 'Food Safety Manager' }
      }
    },

    // Australia
    'AU': {
      countryName: 'Australia',
      certificateName: 'Food Safety Supervisor Certificate',
      certificateDescription: 'Food Safety Supervisor Certificate (varies by state)',
      registrationFormRequired: true,
      registrationFormName: 'Council Food Business Registration',
      formFields: {
        businessName: { required: true, label: 'Business Name' },
        businessAddress: { required: true, label: 'Business Address' },
        contactPerson: { required: true, label: 'Contact Person' },
        phoneNumber: { required: true, label: 'Phone Number' },
        emailAddress: { required: true, label: 'Email Address' },
        typeOfFoodBusiness: { required: true, label: 'Type of Food Business' },
        stateTerritory: { required: true, label: 'State/Territory' },
        operatingHours: { required: false, label: 'Operating Hours' },
        numberOfEmployees: { required: false, label: 'Number of Employees' },
        foodSafetySupervisor: { required: true, label: 'Food Safety Supervisor' }
      }
    },

    // European Union (general)
    'EU': {
      countryName: 'European Union',
      certificateName: 'HACCP Certificate',
      certificateDescription: 'HACCP (Hazard Analysis Critical Control Points) Certificate',
      registrationFormRequired: true,
      registrationFormName: 'EU Food Business Registration',
      formFields: {
        businessName: { required: true, label: 'Business Name' },
        businessAddress: { required: true, label: 'Business Address' },
        contactPerson: { required: true, label: 'Contact Person' },
        phoneNumber: { required: true, label: 'Phone Number' },
        emailAddress: { required: true, label: 'Email Address' },
        typeOfFoodBusiness: { required: true, label: 'Type of Food Business' },
        euCountry: { required: true, label: 'EU Country' },
        operatingHours: { required: false, label: 'Operating Hours' },
        numberOfEmployees: { required: false, label: 'Number of Employees' },
        haccpManager: { required: true, label: 'HACCP Manager' }
      }
    },

    // Germany
    'DE': {
      countryName: 'Germany',
      certificateName: 'Lebensmittelhygiene-Schulung',
      certificateDescription: 'Food Hygiene Training Certificate (Lebensmittelhygiene-Schulung)',
      registrationFormRequired: true,
      registrationFormName: 'Gewerbeanmeldung für Lebensmittelbetrieb',
      formFields: {
        businessName: { required: true, label: 'Betriebsname' },
        businessAddress: { required: true, label: 'Betriebsadresse' },
        contactPerson: { required: true, label: 'Ansprechpartner' },
        phoneNumber: { required: true, label: 'Telefonnummer' },
        emailAddress: { required: true, label: 'E-Mail-Adresse' },
        typeOfFoodBusiness: { required: true, label: 'Art des Lebensmittelbetriebs' },
        operatingHours: { required: false, label: 'Öffnungszeiten' },
        numberOfEmployees: { required: false, label: 'Anzahl der Mitarbeiter' },
        hygieneOfficer: { required: true, label: 'Hygieneverantwortlicher' }
      }
    },

    // France
    'FR': {
      countryName: 'France',
      certificateName: 'Formation Hygiène Alimentaire',
      certificateDescription: 'Food Hygiene Training Certificate (Formation Hygiène Alimentaire)',
      registrationFormRequired: true,
      registrationFormName: 'Déclaration d\'Activité Alimentaire',
      formFields: {
        businessName: { required: true, label: 'Nom de l\'établissement' },
        businessAddress: { required: true, label: 'Adresse de l\'établissement' },
        contactPerson: { required: true, label: 'Personne de contact' },
        phoneNumber: { required: true, label: 'Numéro de téléphone' },
        emailAddress: { required: true, label: 'Adresse e-mail' },
        typeOfFoodBusiness: { required: true, label: 'Type d\'activité alimentaire' },
        operatingHours: { required: false, label: 'Heures d\'ouverture' },
        numberOfEmployees: { required: false, label: 'Nombre d\'employés' },
        hygieneManager: { required: true, label: 'Responsable hygiène' }
      }
    },

    // AFRICAN COUNTRIES

    // Nigeria
    'NG': {
      countryName: 'Nigeria',
      certificateName: 'NAFDAC Food Handler Certificate',
      certificateDescription: 'National Agency for Food and Drug Administration Certificate',
      registrationFormRequired: true,
      registrationFormName: 'NAFDAC Food Business Registration',
      formFields: {
        businessName: { required: true, label: 'Business Name' },
        businessAddress: { required: true, label: 'Business Address' },
        contactPerson: { required: true, label: 'Contact Person' },
        phoneNumber: { required: true, label: 'Phone Number' },
        emailAddress: { required: true, label: 'Email Address' },
        typeOfFoodBusiness: { required: true, label: 'Type of Food Business' },
        stateOfOperation: { required: true, label: 'State of Operation' },
        lgaArea: { required: true, label: 'Local Government Area (LGA)' },
        operatingHours: { required: false, label: 'Operating Hours' },
        numberOfEmployees: { required: false, label: 'Number of Employees' },
        foodSafetyOfficer: { required: true, label: 'Food Safety Officer' }
      }
    },

    // South Africa
    'ZA': {
      countryName: 'South Africa',
      certificateName: 'Food Handler Certificate',
      certificateDescription: 'Department of Health Food Handler Certificate',
      registrationFormRequired: true,
      registrationFormName: 'Municipal Food Business License',
      formFields: {
        businessName: { required: true, label: 'Business Name' },
        businessAddress: { required: true, label: 'Business Address' },
        contactPerson: { required: true, label: 'Contact Person' },
        phoneNumber: { required: true, label: 'Phone Number' },
        emailAddress: { required: true, label: 'Email Address' },
        typeOfFoodBusiness: { required: true, label: 'Type of Food Business' },
        province: { required: true, label: 'Province' },
        municipality: { required: true, label: 'Municipality' },
        operatingHours: { required: false, label: 'Operating Hours' },
        numberOfEmployees: { required: false, label: 'Number of Employees' },
        foodSafetyManager: { required: true, label: 'Food Safety Manager' }
      }
    },

    // Ghana
    'GH': {
      countryName: 'Ghana',
      certificateName: 'FDA Food Handler Certificate',
      certificateDescription: 'Food and Drugs Authority Food Handler Certificate',
      registrationFormRequired: true,
      registrationFormName: 'FDA Food Business Registration',
      formFields: {
        businessName: { required: true, label: 'Business Name' },
        businessAddress: { required: true, label: 'Business Address' },
        contactPerson: { required: true, label: 'Contact Person' },
        phoneNumber: { required: true, label: 'Phone Number' },
        emailAddress: { required: true, label: 'Email Address' },
        typeOfFoodBusiness: { required: true, label: 'Type of Food Business' },
        region: { required: true, label: 'Region' },
        district: { required: true, label: 'District' },
        operatingHours: { required: false, label: 'Operating Hours' },
        numberOfEmployees: { required: false, label: 'Number of Employees' },
        foodSafetyOfficer: { required: true, label: 'Food Safety Officer' }
      }
    },

    // Kenya
    'KE': {
      countryName: 'Kenya',
      certificateName: 'Public Health Officer Certificate',
      certificateDescription: 'Ministry of Health Food Handler Certificate',
      registrationFormRequired: true,
      registrationFormName: 'County Food Business License',
      formFields: {
        businessName: { required: true, label: 'Business Name' },
        businessAddress: { required: true, label: 'Business Address' },
        contactPerson: { required: true, label: 'Contact Person' },
        phoneNumber: { required: true, label: 'Phone Number' },
        emailAddress: { required: true, label: 'Email Address' },
        typeOfFoodBusiness: { required: true, label: 'Type of Food Business' },
        county: { required: true, label: 'County' },
        subCounty: { required: true, label: 'Sub-County' },
        operatingHours: { required: false, label: 'Operating Hours' },
        numberOfEmployees: { required: false, label: 'Number of Employees' },
        publicHealthOfficer: { required: true, label: 'Public Health Officer Contact' }
      }
    },

    // Ethiopia
    'ET': {
      countryName: 'Ethiopia',
      certificateName: 'EFDA Food Safety Certificate',
      certificateDescription: 'Ethiopian Food and Drug Administration Certificate',
      registrationFormRequired: true,
      registrationFormName: 'EFDA Food Business License',
      formFields: {
        businessName: { required: true, label: 'Business Name' },
        businessAddress: { required: true, label: 'Business Address' },
        contactPerson: { required: true, label: 'Contact Person' },
        phoneNumber: { required: true, label: 'Phone Number' },
        emailAddress: { required: true, label: 'Email Address' },
        typeOfFoodBusiness: { required: true, label: 'Type of Food Business' },
        region: { required: true, label: 'Region' },
        woreda: { required: true, label: 'Woreda (District)' },
        operatingHours: { required: false, label: 'Operating Hours' },
        numberOfEmployees: { required: false, label: 'Number of Employees' },
        foodSafetyOfficer: { required: true, label: 'Food Safety Officer' }
      }
    },

    // Uganda
    'UG': {
      countryName: 'Uganda',
      certificateName: 'UNBS Food Safety Certificate',
      certificateDescription: 'Uganda National Bureau of Standards Certificate',
      registrationFormRequired: true,
      registrationFormName: 'District Food Business License',
      formFields: {
        businessName: { required: true, label: 'Business Name' },
        businessAddress: { required: true, label: 'Business Address' },
        contactPerson: { required: true, label: 'Contact Person' },
        phoneNumber: { required: true, label: 'Phone Number' },
        emailAddress: { required: true, label: 'Email Address' },
        typeOfFoodBusiness: { required: true, label: 'Type of Food Business' },
        district: { required: true, label: 'District' },
        subCounty: { required: true, label: 'Sub-County' },
        operatingHours: { required: false, label: 'Operating Hours' },
        numberOfEmployees: { required: false, label: 'Number of Employees' },
        foodSafetyOfficer: { required: false, label: 'Food Safety Officer' }
      }
    },

    // CARIBBEAN COUNTRIES

    // Jamaica
    'JM': {
      countryName: 'Jamaica',
      certificateName: 'Food Handler Permit',
      certificateDescription: 'Ministry of Health Food Handler Permit',
      registrationFormRequired: true,
      registrationFormName: 'Parish Food Business License',
      formFields: {
        businessName: { required: true, label: 'Business Name' },
        businessAddress: { required: true, label: 'Business Address' },
        contactPerson: { required: true, label: 'Contact Person' },
        phoneNumber: { required: true, label: 'Phone Number' },
        emailAddress: { required: true, label: 'Email Address' },
        typeOfFoodBusiness: { required: true, label: 'Type of Food Business' },
        parish: { required: true, label: 'Parish' },
        operatingHours: { required: false, label: 'Operating Hours' },
        numberOfEmployees: { required: false, label: 'Number of Employees' },
        healthInspector: { required: true, label: 'Health Inspector Contact' }
      }
    },

    // Trinidad and Tobago
    'TT': {
      countryName: 'Trinidad and Tobago',
      certificateName: 'Food Handler Certificate',
      certificateDescription: 'Ministry of Health Food Handler Certificate',
      registrationFormRequired: true,
      registrationFormName: 'Municipal Corporation Food License',
      formFields: {
        businessName: { required: true, label: 'Business Name' },
        businessAddress: { required: true, label: 'Business Address' },
        contactPerson: { required: true, label: 'Contact Person' },
        phoneNumber: { required: true, label: 'Phone Number' },
        emailAddress: { required: true, label: 'Email Address' },
        typeOfFoodBusiness: { required: true, label: 'Type of Food Business' },
        island: { required: true, label: 'Island (Trinidad/Tobago)' },
        corporation: { required: true, label: 'Municipal Corporation' },
        operatingHours: { required: false, label: 'Operating Hours' },
        numberOfEmployees: { required: false, label: 'Number of Employees' },
        foodSafetyOfficer: { required: true, label: 'Food Safety Officer' }
      }
    },

    // Barbados
    'BB': {
      countryName: 'Barbados',
      certificateName: 'Food Handler Certificate',
      certificateDescription: 'Ministry of Health Food Handler Certificate',
      registrationFormRequired: true,
      registrationFormName: 'Environmental Health Food License',
      formFields: {
        businessName: { required: true, label: 'Business Name' },
        businessAddress: { required: true, label: 'Business Address' },
        contactPerson: { required: true, label: 'Contact Person' },
        phoneNumber: { required: true, label: 'Phone Number' },
        emailAddress: { required: true, label: 'Email Address' },
        typeOfFoodBusiness: { required: true, label: 'Type of Food Business' },
        parish: { required: true, label: 'Parish' },
        operatingHours: { required: false, label: 'Operating Hours' },
        numberOfEmployees: { required: false, label: 'Number of Employees' },
        environmentalHealthOfficer: { required: true, label: 'Environmental Health Officer' }
      }
    },

    // Bahamas
    'BS': {
      countryName: 'Bahamas',
      certificateName: 'Food Handler License',
      certificateDescription: 'Ministry of Health Food Handler License',
      registrationFormRequired: true,
      registrationFormName: 'Health Services Food Establishment License',
      formFields: {
        businessName: { required: true, label: 'Business Name' },
        businessAddress: { required: true, label: 'Business Address' },
        contactPerson: { required: true, label: 'Contact Person' },
        phoneNumber: { required: true, label: 'Phone Number' },
        emailAddress: { required: true, label: 'Email Address' },
        typeOfFoodBusiness: { required: true, label: 'Type of Food Business' },
        island: { required: true, label: 'Island' },
        operatingHours: { required: false, label: 'Operating Hours' },
        numberOfEmployees: { required: false, label: 'Number of Employees' },
        healthOfficer: { required: true, label: 'Health Officer Contact' }
      }
    },

    // Haiti
    'HT': {
      countryName: 'Haiti',
      certificateName: 'Certificat de Manipulation d\'Aliments',
      certificateDescription: 'Ministry of Public Health Food Handler Certificate',
      registrationFormRequired: true,
      registrationFormName: 'Licence d\'Établissement Alimentaire',
      formFields: {
        businessName: { required: true, label: 'Nom de l\'Entreprise' },
        businessAddress: { required: true, label: 'Adresse de l\'Entreprise' },
        contactPerson: { required: true, label: 'Personne de Contact' },
        phoneNumber: { required: true, label: 'Numéro de Téléphone' },
        emailAddress: { required: true, label: 'Adresse E-mail' },
        typeOfFoodBusiness: { required: true, label: 'Type d\'Entreprise Alimentaire' },
        department: { required: true, label: 'Département' },
        commune: { required: true, label: 'Commune' },
        operatingHours: { required: false, label: 'Heures d\'Ouverture' },
        numberOfEmployees: { required: false, label: 'Nombre d\'Employés' },
        officierSante: { required: true, label: 'Officier de Santé' }
      }
    },

    // MORE AFRICAN COUNTRIES

    // Morocco
    'MA': {
      countryName: 'Morocco',
      certificateName: 'Certificat d\'Hygiène Alimentaire',
      certificateDescription: 'Ministry of Health Food Hygiene Certificate',
      registrationFormRequired: true,
      registrationFormName: 'Licence d\'Établissement Alimentaire',
      formFields: {
        businessName: { required: true, label: 'Nom de l\'Établissement' },
        businessAddress: { required: true, label: 'Adresse' },
        contactPerson: { required: true, label: 'Personne de Contact' },
        phoneNumber: { required: true, label: 'Numéro de Téléphone' },
        emailAddress: { required: true, label: 'E-mail' },
        typeOfFoodBusiness: { required: true, label: 'Type d\'Activité' },
        region: { required: true, label: 'Région' },
        prefecture: { required: true, label: 'Préfecture/Province' },
        operatingHours: { required: false, label: 'Heures d\'Ouverture' },
        numberOfEmployees: { required: false, label: 'Nombre d\'Employés' },
        responsableHygiene: { required: true, label: 'Responsable Hygiène' }
      }
    },

    // Senegal
    'SN': {
      countryName: 'Senegal',
      certificateName: 'Certificat de Manipulation des Aliments',
      certificateDescription: 'Ministry of Health Food Handler Certificate',
      registrationFormRequired: true,
      registrationFormName: 'Autorisation d\'Ouverture d\'Établissement',
      formFields: {
        businessName: { required: true, label: 'Nom de l\'Établissement' },
        businessAddress: { required: true, label: 'Adresse Complète' },
        contactPerson: { required: true, label: 'Personne de Contact' },
        phoneNumber: { required: true, label: 'Téléphone' },
        emailAddress: { required: true, label: 'E-mail' },
        typeOfFoodBusiness: { required: true, label: 'Type d\'Établissement' },
        region: { required: true, label: 'Région' },
        departement: { required: true, label: 'Département' },
        operatingHours: { required: false, label: 'Horaires' },
        numberOfEmployees: { required: false, label: 'Nombre d\'Employés' },
        agentSante: { required: true, label: 'Agent de Santé' }
      }
    },

    // Cameroon
    'CM': {
      countryName: 'Cameroon',
      certificateName: 'Food Safety Certificate',
      certificateDescription: 'Ministry of Public Health Food Safety Certificate',
      registrationFormRequired: true,
      registrationFormName: 'Food Business Operating License',
      formFields: {
        businessName: { required: true, label: 'Business Name' },
        businessAddress: { required: true, label: 'Business Address' },
        contactPerson: { required: true, label: 'Contact Person' },
        phoneNumber: { required: true, label: 'Phone Number' },
        emailAddress: { required: true, label: 'Email Address' },
        typeOfFoodBusiness: { required: true, label: 'Type of Food Business' },
        region: { required: true, label: 'Region' },
        division: { required: true, label: 'Division' },
        operatingHours: { required: false, label: 'Operating Hours' },
        numberOfEmployees: { required: false, label: 'Number of Employees' },
        foodSafetyOfficer: { required: true, label: 'Food Safety Officer' }
      }
    },

    // MORE CARIBBEAN COUNTRIES

    // Dominican Republic
    'DO': {
      countryName: 'Dominican Republic',
      certificateName: 'Certificado de Manipulador de Alimentos',
      certificateDescription: 'Ministry of Health Food Handler Certificate',
      registrationFormRequired: true,
      registrationFormName: 'Licencia de Establecimiento Alimentario',
      formFields: {
        businessName: { required: true, label: 'Nombre del Negocio' },
        businessAddress: { required: true, label: 'Dirección del Negocio' },
        contactPerson: { required: true, label: 'Persona de Contacto' },
        phoneNumber: { required: true, label: 'Número de Teléfono' },
        emailAddress: { required: true, label: 'Correo Electrónico' },
        typeOfFoodBusiness: { required: true, label: 'Tipo de Negocio de Alimentos' },
        province: { required: true, label: 'Provincia' },
        municipality: { required: true, label: 'Municipio' },
        operatingHours: { required: false, label: 'Horario de Operación' },
        numberOfEmployees: { required: false, label: 'Número de Empleados' },
        oficialSalud: { required: true, label: 'Oficial de Salud' }
      }
    },

    // Cuba
    'CU': {
      countryName: 'Cuba',
      certificateName: 'Certificado de Manipulación de Alimentos',
      certificateDescription: 'Ministry of Public Health Food Handler Certificate',
      registrationFormRequired: true,
      registrationFormName: 'Licencia de Actividad Gastronómica',
      formFields: {
        businessName: { required: true, label: 'Nombre del Establecimiento' },
        businessAddress: { required: true, label: 'Dirección' },
        contactPerson: { required: true, label: 'Persona Responsable' },
        phoneNumber: { required: true, label: 'Teléfono' },
        emailAddress: { required: false, label: 'Correo Electrónico' },
        typeOfFoodBusiness: { required: true, label: 'Tipo de Actividad' },
        province: { required: true, label: 'Provincia' },
        municipality: { required: true, label: 'Municipio' },
        operatingHours: { required: false, label: 'Horario' },
        numberOfEmployees: { required: false, label: 'Cantidad de Trabajadores' },
        inspectorSalud: { required: true, label: 'Inspector de Salud' }
      }
    },

    // Puerto Rico (US Territory)
    'PR': {
      countryName: 'Puerto Rico',
      certificateName: 'Certificado de Manipulador de Alimentos',
      certificateDescription: 'Department of Health Food Handler Certificate',
      registrationFormRequired: true,
      registrationFormName: 'Licencia de Establecimiento de Alimentos',
      formFields: {
        businessName: { required: true, label: 'Nombre del Negocio' },
        businessAddress: { required: true, label: 'Dirección del Negocio' },
        contactPerson: { required: true, label: 'Persona de Contacto' },
        phoneNumber: { required: true, label: 'Número de Teléfono' },
        emailAddress: { required: true, label: 'Correo Electrónico' },
        typeOfFoodBusiness: { required: true, label: 'Tipo de Negocio' },
        municipality: { required: true, label: 'Municipio' },
        operatingHours: { required: false, label: 'Horario de Operación' },
        numberOfEmployees: { required: false, label: 'Número de Empleados' },
        oficialSalud: { required: true, label: 'Oficial de Salud' }
      }
    }

    // Additional countries can be added as the platform expands
  };

  // Default fallback for countries not specifically listed
  const defaultRequirements = {
    countryName: 'International',
    certificateName: 'Food Safety Certificate',
    certificateDescription: 'Nationally recognized food safety or hygiene certificate',
    registrationFormRequired: true,
    registrationFormName: 'Food Business Registration',
    formFields: {
      businessName: { required: true, label: 'Business Name' },
      businessAddress: { required: true, label: 'Business Address' },
      contactPerson: { required: true, label: 'Contact Person' },
      phoneNumber: { required: true, label: 'Phone Number' },
      emailAddress: { required: true, label: 'Email Address' },
      typeOfFoodBusiness: { required: true, label: 'Type of Food Business' },
      operatingHours: { required: false, label: 'Operating Hours' },
      numberOfEmployees: { required: false, label: 'Number of Employees' },
      foodSafetyOfficer: { required: false, label: 'Food Safety Officer' }
    }
  };

  return requirements[countryCode] || defaultRequirements;
};

// EU countries that should use EU-specific requirements instead of individual country requirements
export const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'GR', 'HU', 'IE', 
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
];

export const getCountrySpecificRequirements = (countryCode) => {
  // For smaller EU countries, use general EU requirements
  if (EU_COUNTRIES.includes(countryCode) && !['DE', 'FR'].includes(countryCode)) {
    return getFoodHandlingRequirements('EU');
  }
  
  return getFoodHandlingRequirements(countryCode);
};

export const getFoodBusinessTypes = (countryCode) => {
  const commonTypes = [
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'cafe', label: 'Cafe' },
    { value: 'takeaway', label: 'Takeaway' },
    { value: 'catering', label: 'Catering Service' },
    { value: 'food-truck', label: 'Food Truck' },
    { value: 'bakery', label: 'Bakery' },
    { value: 'butcher', label: 'Butcher Shop' },
    { value: 'grocery', label: 'Grocery Store' },
    { value: 'wholesale', label: 'Wholesale Food Distribution' },
    { value: 'other', label: 'Other' }
  ];

  // Country-specific business types can be added here
  const countrySpecificTypes = {
    'US': [
      ...commonTypes,
      { value: 'food-cart', label: 'Food Cart' },
      { value: 'farmers-market', label: 'Farmers Market Vendor' }
    ],
    'DE': [
      ...commonTypes,
      { value: 'metzgerei', label: 'Metzgerei (Traditional Butcher)' },
      { value: 'konditorei', label: 'Konditorei (Pastry Shop)' }
    ],
    // AFRICAN COUNTRIES
    'NG': [
      ...commonTypes,
      { value: 'bukka', label: 'Bukka (Local Restaurant)' },
      { value: 'suya-spot', label: 'Suya Spot' },
      { value: 'pepper-soup-joint', label: 'Pepper Soup Joint' },
      { value: 'mama-put', label: 'Mama Put (Street Food)' },
      { value: 'palm-wine-bar', label: 'Palm Wine Bar with Food' }
    ],
    'GH': [
      ...commonTypes,
      { value: 'chop-bar', label: 'Chop Bar' },
      { value: 'kenkey-seller', label: 'Kenkey Seller' },
      { value: 'waakye-joint', label: 'Waakye Joint' },
      { value: 'fufu-bar', label: 'Fufu Bar' },
      { value: 'street-food', label: 'Street Food Vendor' }
    ],
    'ZA': [
      ...commonTypes,
      { value: 'braai-restaurant', label: 'Braai Restaurant' },
      { value: 'township-tavern', label: 'Township Tavern' },
      { value: 'shisa-nyama', label: 'Shisa Nyama' },
      { value: 'spaza-shop', label: 'Spaza Shop' },
      { value: 'boerewors-stand', label: 'Boerewors Stand' }
    ],
    'KE': [
      ...commonTypes,
      { value: 'nyama-choma', label: 'Nyama Choma Joint' },
      { value: 'ugali-house', label: 'Ugali House' },
      { value: 'mandazi-shop', label: 'Mandazi Shop' },
      { value: 'kibanda', label: 'Kibanda (Food Stall)' },
      { value: 'tea-kiosk', label: 'Tea Kiosk' }
    ],
    'ET': [
      ...commonTypes,
      { value: 'injera-house', label: 'Injera House' },
      { value: 'coffee-ceremony', label: 'Coffee Ceremony House' },
      { value: 'tej-house', label: 'Tej House (Honey Wine)' },
      { value: 'traditional-restaurant', label: 'Traditional Ethiopian Restaurant' }
    ],
    'UG': [
      ...commonTypes,
      { value: 'matooke-joint', label: 'Matooke Joint' },
      { value: 'posho-mill', label: 'Posho Mill & Eatery' },
      { value: 'rolex-stand', label: 'Rolex Stand' },
      { value: 'waragi-bar', label: 'Waragi Bar with Food' }
    ],
    // CARIBBEAN COUNTRIES
    'JM': [
      ...commonTypes,
      { value: 'jerk-center', label: 'Jerk Center' },
      { value: 'patty-shop', label: 'Patty Shop' },
      { value: 'ital-restaurant', label: 'Ital Restaurant' },
      { value: 'rum-bar', label: 'Rum Bar with Food' },
      { value: 'cook-shop', label: 'Cook Shop' },
      { value: 'festival-stand', label: 'Festival Stand' }
    ],
    'TT': [
      ...commonTypes,
      { value: 'doubles-stand', label: 'Doubles Stand' },
      { value: 'roti-shop', label: 'Roti Shop' },
      { value: 'pelau-house', label: 'Pelau House' },
      { value: 'bake-and-shark', label: 'Bake and Shark Stand' },
      { value: 'curry-house', label: 'Curry House' }
    ],
    'BB': [
      ...commonTypes,
      { value: 'flying-fish-restaurant', label: 'Flying Fish Restaurant' },
      { value: 'cou-cou-house', label: 'Cou-Cou House' },
      { value: 'rum-shop', label: 'Rum Shop with Food' },
      { value: 'pudding-souse', label: 'Pudding & Souse Stand' }
    ],
    'BS': [
      ...commonTypes,
      { value: 'conch-bar', label: 'Conch Bar' },
      { value: 'fish-fry', label: 'Fish Fry Stand' },
      { value: 'johnny-cake', label: 'Johnny Cake Shop' },
      { value: 'island-grill', label: 'Island Grill' }
    ],
    'HT': [
      ...commonTypes,
      { value: 'griot-house', label: 'Maison de Griot' },
      { value: 'boukanye', label: 'Boukanye (Grilled Food)' },
      { value: 'fritay', label: 'Fritay Stand' },
      { value: 'clairin-bar', label: 'Bar à Clairin avec Nourriture' }
    ]
  };

  return countrySpecificTypes[countryCode] || commonTypes;
};

export const getCountryFoodSafetyInfo = (countryCode) => {
  const safetyInfo = {
    // AFRICAN COUNTRIES
    'NG': {
      authority: 'National Agency for Food and Drug Administration (NAFDAC)',
      keyRequirements: [
        'NAFDAC registration number for food businesses',
        'Valid food handler certificates for all staff',
        'Regular health inspections by state health officials',
        'Proper storage facilities with temperature controls'
      ],
      commonPerishables: ['Fresh fish', 'Beef', 'Chicken', 'Goat meat', 'Fresh vegetables', 'Dairy products'],
      temperatureRequirements: 'Refrigerated storage below 4°C (39°F) for perishables',
      inspectionFrequency: 'Quarterly health inspections',
      penalties: 'Fines up to ₦500,000 and business closure for violations'
    },
    'GH': {
      authority: 'Food and Drugs Authority (FDA Ghana)',
      keyRequirements: [
        'FDA Ghana business license',
        'Food handler permits for staff handling perishables',
        'District Assembly health clearances',
        'Approved storage and handling facilities'
      ],
      commonPerishables: ['Fresh fish', 'Chicken', 'Beef', 'Fresh fruits', 'Vegetables', 'Palm oil'],
      temperatureRequirements: 'Cold storage at 2-4°C for meat and fish',
      inspectionFrequency: 'Bi-annual FDA inspections',
      penalties: 'Business closure and fines for non-compliance'
    },
    'ZA': {
      authority: 'Department of Health and Municipal Health Services',
      keyRequirements: [
        'Municipal health clearance certificate',
        'Food handler certificates (valid for 3 years)',
        'HACCP compliance for larger operations',
        'Regular water quality testing'
      ],
      commonPerishables: ['Beef', 'Chicken', 'Seafood', 'Dairy products', 'Fresh produce'],
      temperatureRequirements: 'Cold chain maintenance at 0-4°C',
      inspectionFrequency: 'Annual municipal health inspections',
      penalties: 'Business closure and criminal charges for serious violations'
    },
    'KE': {
      authority: 'Ministry of Health and County Health Departments',
      keyRequirements: [
        'County health department license',
        'Public health officer clearance',
        'Food handler permits for all staff',
        'Clean water source certification'
      ],
      commonPerishables: ['Beef', 'Chicken', 'Fresh fish', 'Milk', 'Vegetables', 'Fruits'],
      temperatureRequirements: 'Refrigeration below 5°C for perishables',
      inspectionFrequency: 'Quarterly county health inspections',
      penalties: 'Fines and temporary closure for violations'
    },
    
    // CARIBBEAN COUNTRIES
    'JM': {
      authority: 'Ministry of Health and Wellness',
      keyRequirements: [
        'Food handler permits from parish health departments',
        'Health inspector approval',
        'Parish council business license',
        'Proper waste disposal systems'
      ],
      commonPerishables: ['Fresh fish', 'Chicken', 'Pork', 'Goat', 'Fresh fruits', 'Vegetables'],
      temperatureRequirements: 'Refrigeration at 1-4°C for meat and fish',
      inspectionFrequency: 'Regular parish health department visits',
      penalties: 'Business closure and fines up to J$100,000'
    },
    'TT': {
      authority: 'Ministry of Health and Municipal Corporations',
      keyRequirements: [
        'Municipal corporation food license',
        'Health department clearance',
        'Food handler certificates',
        'Vector control compliance'
      ],
      commonPerishables: ['Fresh fish', 'Chicken', 'Beef', 'Seafood', 'Fresh produce'],
      temperatureRequirements: 'Cold storage below 4°C',
      inspectionFrequency: 'Bi-annual municipal inspections',
      penalties: 'Fines up to TT$25,000 and business closure'
    },
    'BB': {
      authority: 'Ministry of Health and Environmental Health Department',
      keyRequirements: [
        'Environmental health food license',
        'Food handler certificates',
        'Parish health approval',
        'Proper sanitation facilities'
      ],
      commonPerishables: ['Flying fish', 'Chicken', 'Pork', 'Fresh produce', 'Dairy'],
      temperatureRequirements: 'Refrigeration at 2-4°C',
      inspectionFrequency: 'Annual environmental health inspections',
      penalties: 'Business closure for health violations'
    },
    
    // EUROPEAN COUNTRIES
    'GB': {
      authority: 'Food Standards Agency (FSA) and Local Councils',
      keyRequirements: [
        'Food hygiene rating scheme participation',
        'Level 2 food safety certificates',
        'Local authority registration',
        'HACCP procedures implementation'
      ],
      commonPerishables: ['Fresh meat', 'Poultry', 'Fish', 'Dairy', 'Ready-to-eat foods'],
      temperatureRequirements: 'Chilled foods at 0-5°C, frozen at -18°C',
      inspectionFrequency: 'Risk-based local authority inspections',
      penalties: 'Fines up to £20,000 and imprisonment for serious offenses'
    },
    
    // NORTH AMERICAN COUNTRIES
    'US': {
      authority: 'FDA and State Health Departments',
      keyRequirements: [
        'State food handler permits',
        'FDA food facility registration',
        'HACCP plans for high-risk foods',
        'Local health department licenses'
      ],
      commonPerishables: ['Meat', 'Poultry', 'Seafood', 'Dairy', 'Fresh produce'],
      temperatureRequirements: 'Cold foods below 41°F (5°C), hot foods above 135°F (57°C)',
      inspectionFrequency: 'Annual state health department inspections',
      penalties: 'Fines up to $100,000 and criminal prosecution'
    }
  };

  // Default information for countries not specifically listed
  const defaultInfo = {
    authority: 'Local Health Department',
    keyRequirements: [
      'Food safety certification',
      'Business health license',
      'Regular health inspections',
      'Proper food storage facilities'
    ],
    commonPerishables: ['Fresh meat', 'Poultry', 'Fish', 'Dairy products', 'Fresh produce'],
    temperatureRequirements: 'Proper refrigeration below 5°C (41°F)',
    inspectionFrequency: 'Regular health authority inspections',
    penalties: 'Fines and business closure for violations'
  };

  return safetyInfo[countryCode] || defaultInfo;
};

export const getPerishableFoodExamples = (countryCode) => {
  const examples = {
    'NG': ['Fresh fish (catfish, tilapia)', 'Beef (cow meat)', 'Chicken', 'Goat meat', 'Fresh vegetables', 'Palm oil', 'Dairy products'],
    'GH': ['Fresh fish (tilapia, tuna)', 'Chicken', 'Beef', 'Fresh fruits (mangoes, pineapple)', 'Vegetables', 'Palm oil'],
    'ZA': ['Beef (biltong preparations)', 'Chicken', 'Seafood', 'Dairy products', 'Fresh produce'],
    'KE': ['Beef', 'Chicken', 'Fresh fish (tilapia)', 'Milk', 'Vegetables', 'Fruits'],
    'JM': ['Fresh fish (snapper, kingfish)', 'Chicken', 'Pork', 'Goat', 'Fresh tropical fruits', 'Vegetables'],
    'TT': ['Fresh fish (kingfish, red snapper)', 'Chicken', 'Beef', 'Seafood (shrimp, crab)', 'Fresh produce'],
    'BB': ['Flying fish', 'Chicken', 'Pork', 'Fresh produce', 'Dairy products'],
    'GB': ['Fresh meat', 'Poultry', 'Fish', 'Dairy products', 'Ready-to-eat foods'],
    'US': ['Meat', 'Poultry', 'Seafood', 'Dairy products', 'Fresh produce']
  };

  return examples[countryCode] || ['Fresh meat', 'Poultry', 'Fish', 'Dairy products', 'Fresh vegetables and fruits'];
};

export const getPerishableFoodRequirements = (countryCode) => {
  const requirements = {
    // AFRICAN COUNTRIES
    'NG': {
      documentType: 'Cold Storage Facility Certificate',
      description: 'NAFDAC-approved cold storage facility certificate or refrigeration equipment certification',
      alternativeOptions: [
        'Refrigeration equipment purchase receipt and warranty',
        'Cold storage facility rental agreement with temperature monitoring logs',
        'Temperature monitoring device calibration certificate',
        'Supplier cold-chain compliance certificate'
      ]
    },
    'GH': {
      documentType: 'Cold Chain Compliance Certificate',
      description: 'FDA Ghana cold chain facility approval or refrigeration equipment certification',
      alternativeOptions: [
        'Refrigeration equipment installation certificate',
        'Cold storage facility inspection report',
        'Temperature logging system documentation',
        'Supplier chain custody documentation'
      ]
    },
    'ZA': {
      documentType: 'Refrigeration Equipment Certificate',
      description: 'Municipal health-approved cold storage facility or equipment certification',
      alternativeOptions: [
        'SABS-approved refrigeration equipment certificate',
        'Cold storage facility lease with health approval',
        'Temperature monitoring system documentation',
        'Supplier cold chain verification letter'
      ]
    },
    'KE': {
      documentType: 'Cold Storage Approval',
      description: 'County health department cold storage facility approval or equipment certification',
      alternativeOptions: [
        'Refrigeration equipment purchase and installation receipt',
        'Cold storage facility rental agreement',
        'Temperature monitoring device certificate',
        'Supplier cold chain compliance letter'
      ]
    },
    
    // CARIBBEAN COUNTRIES
    'JM': {
      documentType: 'Refrigeration Facility Certificate',
      description: 'Parish health department cold storage approval or refrigeration equipment certification',
      alternativeOptions: [
        'Refrigeration equipment purchase receipt',
        'Cold storage facility inspection certificate',
        'Temperature monitoring logs (last 3 months)',
        'Supplier refrigerated transport certification'
      ]
    },
    'TT': {
      documentType: 'Cold Chain Facility Approval',
      description: 'Municipal corporation cold storage facility approval or equipment certification',
      alternativeOptions: [
        'Refrigeration equipment warranty and service agreement',
        'Cold storage facility compliance certificate',
        'Temperature monitoring system documentation',
        'Supplier cold chain verification'
      ]
    },
    'BB': {
      documentType: 'Cold Storage License',
      description: 'Environmental health cold storage facility license or equipment certification',
      alternativeOptions: [
        'Refrigeration equipment installation certificate',
        'Cold storage facility health inspection report',
        'Temperature monitoring device calibration',
        'Supplier cold chain documentation'
      ]
    },
    
    // EUROPEAN COUNTRIES
    'GB': {
      documentType: 'Cold Storage Compliance Certificate',
      description: 'Local authority cold storage facility approval or HACCP temperature monitoring documentation',
      alternativeOptions: [
        'Refrigeration equipment service and calibration certificate',
        'Cold storage facility inspection report',
        'Temperature monitoring system documentation (last 6 months)',
        'Supplier cold chain verification letter'
      ]
    },
    
    // NORTH AMERICAN COUNTRIES
    'US': {
      documentType: 'Cold Storage Facility Permit',
      description: 'State health department cold storage facility permit or FDA-compliant temperature monitoring documentation',
      alternativeOptions: [
        'Refrigeration equipment certification and service records',
        'Cold storage facility inspection certificate',
        'Temperature monitoring system documentation',
        'Supplier cold chain compliance verification'
      ]
    }
  };

  // Default for countries not specifically listed
  const defaultRequirement = {
    documentType: 'Cold Storage Documentation',
    description: 'Cold storage facility approval or refrigeration equipment certification from local health authorities',
    alternativeOptions: [
      'Refrigeration equipment purchase receipt and warranty',
      'Cold storage facility rental agreement or inspection report',
      'Temperature monitoring device documentation',
      'Supplier cold chain compliance letter'
    ]
  };

  return requirements[countryCode] || defaultRequirement;
};