#!/bin/bash
#
# This script packages your project into a solution distributable that can be
# used as an input to the solution builder validation pipeline.
# 
# This script will perform the following tasks:
#   1. Remove any old dist files from previous runs.
#   2. Install dependencies for the cdk-solution-helper; responsible for 
#      converting standard 'cdk synth' output into solution assets.
#   3. Build and synthesize your CDK project.
#   4. Run the cdk-solution-helper on template outputs and organize
#      those outputs into the /global-s3-assets folder.
#   5. Organize source code artifacts into the /regional-s3-assets folder.
#   6. Remove any temporary files used for staging.
#
# Parameters:
#  - source-bucket-base-name: Name for the S3 bucket location where the template will source the Lambda
#    code from. The template will append '-[region_name]' to this bucket name.
#    For example: ./build-s3-dist.sh solutions v1.0.0
#    The template will then expect the source code to be located in the solutions-[region_name] bucket
#  - solution-name: name of the solution for consistency
#  - version-code: version of the package

# Important: CDK global version number
cdk_version=1.64.1

# Check to see if the required parameters have been provided:
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Please provide the base source bucket name, trademark approved solution name and version where the lambda code will eventually reside."
    echo "For example: ./build-s3-dist.sh solutions trademarked-solution-name v1.0.0"
    exit 1
fi

export DIST_VERSION=$3
export DIST_OUTPUT_BUCKET=$1
export SOLUTION_ID=SO0104
export SOLUTION_NAME=$2
export SOLUTION_TRADEMARKEDNAME=$2

echo $DIST_OUTPUT_BUCKET

# Get reference for all important folders
template_dir="$PWD"
template_dist_dir="$template_dir/global-s3-assets"
build_dist_dir="$template_dir/regional-s3-assets"
source_dir="$template_dir/../source"
staging_dist_dir="$source_dir/cdk.out"

echo "------------------------------------------------------------------------------"
echo "[Init] Remove any old dist files from previous runs"
echo "------------------------------------------------------------------------------"

echo "rm -rf $template_dist_dir"
rm -rf $template_dist_dir
echo "mkdir -p $template_dist_dir"
mkdir -p $template_dist_dir
echo "rm -rf $build_dist_dir"
rm -rf $build_dist_dir
echo "mkdir -p $build_dist_dir"
mkdir -p $build_dist_dir
echo "rm -rf $staging_dist_dir"
# rm -rf $staging_dist_dir
# echo "mkdir -p $staging_dist_dir"
# mkdir -p $staging_dist_dir

echo "------------------------------------------------------------------------------"
echo "[Synth] CDK Project"
echo "------------------------------------------------------------------------------"

# Install the global aws-cdk package
npm run cdk --version
echo "cd $source_dir"
cd $source_dir
echo "npm install -g aws-cdk@$cdk_version"
# npm install -g aws-cdk

echo "------------------------------------------------------------------------------"
echo "NPM Install in the source folder"
echo "------------------------------------------------------------------------------"

# Install the npm install in the source folder
echo "npm install"
npm install

# Run npm run build && npm run test for the cdk component unit tests
echo "npm run build && npm run test"
npm run build && npm run test

# Run all the python tests.
# echo "$template_dir/run-unit-tests.sh"
# $template_dir/run-unit-tests.sh 


# Run 'cdk synth' to generate raw solution outputs
echo "cdk synth --output=$staging_dist_dir"
npm run cdk synth


# Remove unnecessary output files
echo "cd $staging_dist_dir"
cd $staging_dist_dir
echo "rm tree.json manifest.json cdk.out"
rm tree.json manifest.json cdk.out

echo "------------------------------------------------------------------------------"
echo "[Packing] Template artifacts"
echo "------------------------------------------------------------------------------"

# Move outputs from staging to template_dist_dir
echo "Move outputs from staging to template_dist_dir"
echo "cp $staging_dist_dir/*.template $template_dist_dir/"
# cp $staging_dist_dir/InnovationSandbox.template.json $template_dist_dir/aws-innovation-sandbox.template.json
# Renaming InnovationSandbox.template to match AWS Solution Trademark name
mv $staging_dist_dir/InnovationSandbox.template.json $staging_dist_dir/aws-innovation-sandbox.template.json
cp $staging_dist_dir/*.template.json $template_dist_dir/
cp $source_dir/cloudformation_templates/* $template_dist_dir/
rm *.template.json

# Rename all *.template.json files to *.template
echo "Rename all *.template.json to *.template"
echo "copy templates and rename"
for f in $template_dist_dir/*.template.json; do 
    mv -- "$f" "${f%.template.json}.template"
done



echo "------------------------------------------------------------------------------"
echo "[Packing] Source code lambda python artifacts and scheduler-cli artifacts"
echo "------------------------------------------------------------------------------"
echo "Copy the python lambda files from source/lambda directory to staging lambda directory"
cp -pr $source_dir/Lambda $staging_dist_dir/
# cp -pr $source_dir/cli $staging_dist_dir/

# echo "Update the version information in version.py"
cd $staging_dist_dir/Lambda
# mv version.py version.py.org
# sed "s/%version%/$DIST_VERSION/g" version.py.org > version.py

echo "Install all the python dependencies in the staging directory before packaging"
virtualenv env
source ./env/bin/activate
pip3 install -r $source_dir/Lambda/reqs.txt
cd ./env/lib/py*/site-packages
zip -r9 $staging_dist_dir/Lambda/InnovationSandbox.zip .
cd $staging_dist_dir/Lambda
zip -r9 ./InnovationSandbox.zip ./innovation*.py
zip -r9 ./InnovationSandbox.zip utils

echo "Build lambda distribution packaging"
# zip -q --recurse-paths ./instance-scheduler.zip version.txt main.py version.py configuration/* requesthandlers/* chardet/* urllib3/* idna/* requests/* schedulers/* util/* boto_retry/* models/* pytz/* certifi/*
echo "Copy lambda distribution to $build_dist_dir"
cp -pr ./InnovationSandbox.zip $build_dist_dir/


rm -rf $staging_dist_dir

echo "Moving Regional Assets to build_dist_dir"

mv $template_dist_dir/InnovationSandboxManagementAccount.template $template_dist_dir/InnovationSandboxSbxAccount.template $template_dist_dir/InnovationSandboxTransitGatewaySetup.template $build_dist_dir
cp $source_dir/service_control_policies/* $build_dist_dir

