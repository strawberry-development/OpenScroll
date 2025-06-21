#!/bin/bash

# Enhanced OpenScroll Build Script for Linux
# Usage: ./build.sh [options]
# Options:
#   -m, --minify    Create minified version
#   -h, --help      Show help message

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
SRC_DIR="$SCRIPT_DIR/src"
PLUGINS_DIR="$SCRIPT_DIR/plugins"
OUTPUT_FILE="$DIST_DIR/openscroll.js"
MIN_OUTPUT_FILE="$DIST_DIR/openscroll.min.js"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
MINIFY=false
HELP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -m|--minify)
            MINIFY=true
            shift
            ;;
        -h|--help)
            HELP=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Show help
if [ "$HELP" = true ]; then
    echo "OpenScroll Build Script"
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -m, --minify    Create minified version using uglify-js"
    echo "  -h, --help      Show this help message"
    echo ""
    echo "Requirements for minification:"
    echo "  npm install -g uglify-js"
    exit 0
fi

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to get file size in human readable format
get_file_size() {
    if command -v numfmt >/dev/null 2>&1; then
        local size=$(stat -c%s "$1" 2>/dev/null || stat -f%z "$1" 2>/dev/null)
        echo "$(numfmt --to=iec-i --suffix=B $size) ($size bytes)"
    else
        local size=$(stat -c%s "$1" 2>/dev/null || stat -f%z "$1" 2>/dev/null)
        echo "$size bytes"
    fi
}

# Function to check if uglify-js is available
check_uglifyjs() {
    if ! command -v uglifyjs >/dev/null 2>&1; then
        print_error "uglify-js not found. Install it with: npm install -g uglify-js"
        return 1
    fi
    return 0
}

# Function to add file header
add_header() {
    local file="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    cat > "$file" << EOF
/*!
 * OpenScroll Distribution Build
 * Generated on: $timestamp
 * Build script: $(basename "$0")
 *
 * This file combines all source and plugin files into a single distribution.
 */

EOF
}

# Function to process and combine files
combine_files() {
    local output="$1"
    local file_count=0

    print_status "Combining source files..."

    # Process source files
    if [ -d "$SRC_DIR" ]; then
        while IFS= read -r -d '' file; do
            echo "" >> "$output"
            echo "// === Source: $(basename "$file") ===" >> "$output"
            cat "$file" >> "$output"
            echo "" >> "$output"
            ((file_count++))
        done < <(find "$SRC_DIR" -name "*.js" -type f -print0 | sort -z)
        print_status "Added $file_count source files"
    else
        print_warning "Source directory '$SRC_DIR' not found"
    fi

    # Process plugin files
    local plugin_count=0
    if [ -d "$PLUGINS_DIR" ]; then
        for file in "$PLUGINS_DIR"/*.js; do
            if [ -f "$file" ]; then
                echo "" >> "$output"
                echo "// === Plugin: $(basename "$file") ===" >> "$output"
                cat "$file" >> "$output"
                echo "" >> "$output"
                ((plugin_count++))
            fi
        done
        print_status "Added $plugin_count plugin files"
    else
        print_warning "Plugins directory '$PLUGINS_DIR' not found"
    fi

    local total_files=$((file_count + plugin_count))
    if [ $total_files -eq 0 ]; then
        print_error "No JavaScript files found to combine!"
        exit 1
    fi

    print_success "Combined $total_files files total"
}

# Main execution
print_status "Starting OpenScroll build process..."

# Create dist directory
if [ ! -d "$DIST_DIR" ]; then
    mkdir -p "$DIST_DIR"
    print_status "Created dist directory"
fi

# Remove existing output file
if [ -f "$OUTPUT_FILE" ]; then
    rm "$OUTPUT_FILE"
fi

# Add header to output file
add_header "$OUTPUT_FILE"

# Combine all files
combine_files "$OUTPUT_FILE"

# Display results
print_success "Build complete!"
echo "📄 Output file: $OUTPUT_FILE"
echo "📊 File size: $(get_file_size "$OUTPUT_FILE")"

# Create minified version if requested
if [ "$MINIFY" = true ]; then
    print_status "Creating minified version..."

    if check_uglifyjs; then
        uglifyjs "$OUTPUT_FILE" \
            --compress drop_console=true,drop_debugger=true \
            --mangle \
            --output "$MIN_OUTPUT_FILE" \
            --source-map "filename='$(basename "$MIN_OUTPUT_FILE").map',url='$(basename "$MIN_OUTPUT_FILE").map'"

        if [ -f "$MIN_OUTPUT_FILE" ]; then
            print_success "Minification complete!"
            echo "📄 Minified file: $MIN_OUTPUT_FILE"
            echo "📊 Minified size: $(get_file_size "$MIN_OUTPUT_FILE")"

            # Calculate compression ratio
            original_size=$(stat -c%s "$OUTPUT_FILE" 2>/dev/null || stat -f%z "$OUTPUT_FILE" 2>/dev/null)
            minified_size=$(stat -c%s "$MIN_OUTPUT_FILE" 2>/dev/null || stat -f%z "$MIN_OUTPUT_FILE" 2>/dev/null)
            reduction=$((100 - (minified_size * 100 / original_size)))
            echo "📈 Size reduction: ${reduction}%"
        else
            print_error "Minification failed!"
            exit 1
        fi
    else
        exit 1
    fi
fi

print_success "All operations completed successfully! ✨"