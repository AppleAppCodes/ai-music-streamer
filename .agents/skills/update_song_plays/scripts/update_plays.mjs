import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eiqelhjugiwckvxyixyh.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpcWVsaGp1Z2l3Y2t2eHlpeHloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDE4ODkzNSwiZXhwIjoyMDk1NzY0OTM1fQ.yTT2qCb-qKeNHcbcB3hPCwr3MatIdhr0ytOHqoOYtZo';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function printHelp() {
  console.log(`
Usage:
  node update_plays.mjs [options]

Options:
  --all                 Update all songs in the database.
  --song "<title>"      Update a specific song by its title (exact or partial match).
  --id "<uuid>"         Update a specific song by its Supabase ID.
  --plays <number>      Set plays to this exact number. If omitted, plays will be randomized.
  --min <number>        Minimum plays for random generation (default: 1).
  --max <number>        Maximum plays for random generation (default: 30000).

Examples:
  # Randomize all songs between 1 and 30k plays:
  node update_plays.mjs --all

  # Randomize all songs between 5k and 15k plays:
  node update_plays.mjs --all --min 5000 --max 15000

  # Set plays of "Tinder Luv" to exactly 12,500:
  node update_plays.mjs --song "Tinder Luv" --plays 12500

  # Randomize plays of "Come Closer" between 10k and 20k:
  node update_plays.mjs --song "Come Closer" --min 10000 --max 20000
`);
}

// Parse args
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].slice(2);
    const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
    options[key] = value;
  }
}

const playsVal = options.plays !== undefined ? parseInt(options.plays, 10) : null;
const minVal = options.min !== undefined ? parseInt(options.min, 10) : 1;
const maxVal = options.max !== undefined ? parseInt(options.max, 10) : 30000;

function getTargetPlays() {
  if (playsVal !== null) return playsVal;
  return Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
}

async function run() {
  if (options.help || Object.keys(options).length === 0) {
    printHelp();
    return;
  }

  if (options.all) {
    console.log(`Fetching all songs from Supabase...`);
    const { data: songs, error: fetchError } = await supabase
      .from('songs')
      .select('id, title, plays');

    if (fetchError) {
      console.error('Error fetching songs:', fetchError);
      return;
    }

    console.log(`Found ${songs.length} songs. Starting updates...`);

    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      const newPlays = getTargetPlays();
      console.log(`[${i + 1}/${songs.length}] Updating "${song.title}": ${song.plays} -> ${newPlays} plays`);
      
      const { error: updateError } = await supabase
        .from('songs')
        .update({ plays: newPlays })
        .eq('id', song.id);

      if (updateError) {
        console.error(`Failed to update "${song.title}":`, updateError);
      }
    }
    console.log('All song updates completed.');
    
  } else if (options.song) {
    const titleQuery = options.song;
    console.log(`Searching for song matching title: "${titleQuery}"...`);
    const { data: songs, error: fetchError } = await supabase
      .from('songs')
      .select('id, title, plays')
      .ilike('title', `%${titleQuery}%`);

    if (fetchError) {
      console.error('Error fetching songs:', fetchError);
      return;
    }

    if (songs.length === 0) {
      console.log(`No song found matching "${titleQuery}".`);
      return;
    }

    if (songs.length > 1) {
      console.log(`Found multiple matches. Please be more specific:`);
      songs.forEach(s => console.log(`- ID: ${s.id} | Title: "${s.title}" | Plays: ${s.plays}`));
      return;
    }

    const song = songs[0];
    const newPlays = getTargetPlays();
    console.log(`Updating "${song.title}": ${song.plays} -> ${newPlays} plays...`);
    
    const { error: updateError } = await supabase
      .from('songs')
      .update({ plays: newPlays })
      .eq('id', song.id);

    if (updateError) {
      console.error('Failed to update plays:', updateError);
    } else {
      console.log('Update successful!');
    }

  } else if (options.id) {
    const songId = options.id;
    console.log(`Fetching song with ID: "${songId}"...`);
    const { data: songs, error: fetchError } = await supabase
      .from('songs')
      .select('id, title, plays')
      .eq('id', songId);

    if (fetchError) {
      console.error('Error fetching song:', fetchError);
      return;
    }

    if (songs.length === 0) {
      console.log(`No song found with ID "${songId}".`);
      return;
    }

    const song = songs[0];
    const newPlays = getTargetPlays();
    console.log(`Updating "${song.title}": ${song.plays} -> ${newPlays} plays...`);

    const { error: updateError } = await supabase
      .from('songs')
      .update({ plays: newPlays })
      .eq('id', song.id);

    if (updateError) {
      console.error('Failed to update plays:', updateError);
    } else {
      console.log('Update successful!');
    }
  } else {
    console.log('Error: Invalid option. Use --all, --song, or --id.');
    printHelp();
  }
}

run().catch(console.error);
