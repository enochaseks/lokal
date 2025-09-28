# Script to verify environment variables are loaded correctly

# Create a simple test file
$testFile = "env-test.js"

# Write code to check environment variables
@"
console.log('Checking environment variables...');
console.log('All REACT_APP_ variables:', Object.keys(process.env).filter(key => key.startsWith('REACT_APP_')));
console.log('REACT_APP_HUBSPOT_API_KEY available:', !!process.env.REACT_APP_HUBSPOT_API_KEY);
console.log('HUBSPOT API KEY:', process.env.REACT_APP_HUBSPOT_API_KEY ? process.env.REACT_APP_HUBSPOT_API_KEY.substring(0, 10) + '...' : 'not set');
"@ | Out-File -FilePath $testFile -Encoding utf8

# Run the test file
Write-Host "Testing environment variables..."
node $testFile

# Clean up
Remove-Item $testFile