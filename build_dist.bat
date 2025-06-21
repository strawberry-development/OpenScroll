@echo off
setlocal enabledelayedexpansion

REM Enhanced OpenScroll Build Script for Windows
REM Usage: build.bat [options]
REM Options:
REM   /m or /minify    Create minified version
REM   /h or /help      Show help message

REM Configuration
set "SCRIPT_DIR=%~dp0"
set "DIST_DIR=%SCRIPT_DIR%dist"
set "SRC_DIR=%SCRIPT_DIR%src"
set "PLUGINS_DIR=%SCRIPT_DIR%plugins"
set "OUTPUT_FILE=%DIST_DIR%\openscroll.js"
set "MIN_OUTPUT_FILE=%DIST_DIR%\openscroll.min.js"

REM Parse command line arguments
set "MINIFY=false"
set "HELP=false"

:parse_args
if "%~1"=="" goto :args_done
if /i "%~1"=="/m" set "MINIFY=true"
if /i "%~1"=="/minify" set "MINIFY=true"
if /i "%~1"=="/h" set "HELP=true"
if /i "%~1"=="/help" set "HELP=true"
if /i "%~1"=="-m" set "MINIFY=true"
if /i "%~1"=="--minify" set "MINIFY=true"
if /i "%~1"=="-h" set "HELP=true"
if /i "%~1"=="--help" set "HELP=true"
shift
goto :parse_args
:args_done

REM Show help
if "%HELP%"=="true" (
    echo OpenScroll Build Script
    echo Usage: %~nx0 [options]
    echo.
    echo Options:
    echo   /m, /minify     Create minified version using uglify-js
    echo   /h, /help       Show this help message
    echo.
    echo Requirements for minification:
    echo   npm install -g uglify-js
    exit /b 0
)

REM Functions for colored output (Windows 10+ with ANSI support)
call :enable_colors

echo [96m[INFO][0m Starting OpenScroll build process...

REM Create dist directory
if not exist "%DIST_DIR%" (
    mkdir "%DIST_DIR%"
    echo [96m[INFO][0m Created dist directory
)

REM Remove existing output file
if exist "%OUTPUT_FILE%" del "%OUTPUT_FILE%"

REM Add header to output file
call :add_header "%OUTPUT_FILE%"

REM Combine all files
call :combine_files "%OUTPUT_FILE%"

REM Display results
echo [92m[SUCCESS][0m Build complete!
echo 📄 Output file: %OUTPUT_FILE%
call :get_file_size "%OUTPUT_FILE%"

REM Create minified version if requested
if "%MINIFY%"=="true" (
    echo [96m[INFO][0m Creating minified version...
    call :check_uglifyjs
    if !errorlevel! equ 0 (
        call :minify_file "%OUTPUT_FILE%" "%MIN_OUTPUT_FILE%"
    ) else (
        echo [91m[ERROR][0m Cannot create minified version
        exit /b 1
    )
)

echo [92m[SUCCESS][0m All operations completed successfully! ✨
pause
exit /b 0

REM ===== FUNCTIONS =====

:enable_colors
REM Try to enable ANSI color support on Windows 10+
reg add HKEY_CURRENT_USER\Console /v VirtualTerminalLevel /t REG_DWORD /d 1 /f >nul 2>&1
exit /b 0

:add_header
set "output_file=%~1"
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do set "current_date=%%c-%%a-%%b"
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do set "current_time=%%a:%%b"
(
    echo /*!
    echo  * OpenScroll Distribution Build
    echo  * Generated on: %current_date% %current_time%
    echo  * Build script: %~nx0
    echo  *
    echo  * This file combines all source and plugin files into a single distribution.
    echo  */
    echo.
) > "%output_file%"
exit /b 0

:combine_files
set "output_file=%~1"
set "file_count=0"
set "plugin_count=0"

echo [96m[INFO][0m Combining source files...

REM Process source files
if exist "%SRC_DIR%" (
    for /r "%SRC_DIR%" %%f in (*.js) do (
        echo. >> "%output_file%"
        echo // === Source: %%~nxf === >> "%output_file%"
        type "%%f" >> "%output_file%"
        echo. >> "%output_file%"
        set /a file_count+=1
    )
    echo [96m[INFO][0m Added !file_count! source files
) else (
    echo [93m[WARNING][0m Source directory '%SRC_DIR%' not found
)

REM Process plugin files
if exist "%PLUGINS_DIR%" (
    for %%f in ("%PLUGINS_DIR%\*.js") do (
        if exist "%%f" (
            echo. >> "%output_file%"
            echo // === Plugin: %%~nxf === >> "%output_file%"
            type "%%f" >> "%output_file%"
            echo. >> "%output_file%"
            set /a plugin_count+=1
        )
    )
    echo [96m[INFO][0m Added !plugin_count! plugin files
) else (
    echo [93m[WARNING][0m Plugins directory '%PLUGINS_DIR%' not found
)

set /a total_files=file_count+plugin_count
if !total_files! equ 0 (
    echo [91m[ERROR][0m No JavaScript files found to combine!
    exit /b 1
)

echo [92m[SUCCESS][0m Combined !total_files! files total
exit /b 0

:get_file_size
set "file_path=%~1"
for %%f in ("%file_path%") do (
    set "size=%%~zf"
    echo 📊 File size: !size! bytes
)
exit /b 0

:check_uglifyjs
where uglifyjs >nul 2>&1
if %errorlevel% neq 0 (
    echo [91m[ERROR][0m uglify-js not found. Install it with: npm install -g uglify-js
    exit /b 1
)
exit /b 0

:minify_file
set "input_file=%~1"
set "output_file=%~2"

uglifyjs "%input_file%" --compress drop_console=true,drop_debugger=true --mangle --output "%output_file%" --source-map "filename='%~n2.map',url='%~n2.map'"

if exist "%output_file%" (
    echo [92m[SUCCESS][0m Minification complete!
    echo 📄 Minified file: %output_file%
    call :get_file_size "%output_file%"
    call :calculate_compression "%input_file%" "%output_file%"
) else (
    echo [91m[ERROR][0m Minification failed!
    exit /b 1
)
exit /b 0

:calculate_compression
set "original_file=%~1"
set "minified_file=%~2"

for %%f in ("%original_file%") do set "original_size=%%~zf"
for %%f in ("%minified_file%") do set "minified_size=%%~zf"

set /a reduction=100-(minified_size*100/original_size)
echo 📈 Size reduction: !reduction!%%
exit /b 0