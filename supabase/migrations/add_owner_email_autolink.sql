-- Add email column to salarycap_owners for auto-linking
ALTER TABLE salarycap_owners ADD COLUMN IF NOT EXISTS email TEXT;

-- Populate emails for remaining unlinked owners
UPDATE salarycap_owners SET email = 'coach.meyer.chop@gmail.com' WHERE owner_name = 'Nick Meyer';
UPDATE salarycap_owners SET email = 'scottnw36@gmail.com' WHERE owner_name = 'Nick Scott';
UPDATE salarycap_owners SET email = 'rhossick@gmail.com' WHERE owner_name = 'Ryan Hossick';

-- Also set emails for already-linked owners (for completeness)
UPDATE salarycap_owners SET email = 'wandell.brad@gmail.com' WHERE owner_name = 'Brad Wandell';
UPDATE salarycap_owners SET email = 'rgreen0789@yahoo.com' WHERE owner_name = 'Corey Whitehead & Rob Green';
UPDATE salarycap_owners SET email = 'joshuasacks1@gmail.com' WHERE owner_name = 'Josh Sacks';
UPDATE salarycap_owners SET email = 'scotty.moran@gmail.com' WHERE owner_name = 'Scott Moran';
UPDATE salarycap_owners SET email = 'timothykmeyers@gmail.com' WHERE owner_name = 'Tim Meyers';
UPDATE salarycap_owners SET email = 'tybulger@gmail.com' WHERE owner_name = 'Tyler Bulger';
UPDATE salarycap_owners SET email = 'zachmoore12@gmail.com' WHERE owner_name = 'Zach Moore';
UPDATE salarycap_owners SET email = 'brent0530@gmail.com' WHERE owner_name = 'Brent Alexander';
UPDATE salarycap_owners SET email = 'jonny.goodwin@gmail.com' WHERE owner_name = 'Johnny Goodwin';

-- Create function to auto-link profiles to salarycap_owners
CREATE OR REPLACE FUNCTION link_profile_to_salarycap_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new profile is created, check if their email matches an unlinked salarycap_owner
  UPDATE salarycap_owners
  SET profile_id = NEW.id
  WHERE email = NEW.email
    AND profile_id IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS on_profile_created_link_salarycap ON profiles;
CREATE TRIGGER on_profile_created_link_salarycap
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION link_profile_to_salarycap_owner();
